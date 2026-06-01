import Elysia from "elysia";
import Stripe from "stripe";
import { getDb, subscriptionStatusEnum } from "@axel-saas/db";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { ProvisioningRepository } from "../repositories/provisioningRepository";
import { userRepository } from "../repositories/userRepository";
import {
  triggerContainerLaunch,
  resolveWorkspacePath,
} from "../provisioning/provisioningService";
import { normaliseTier } from "./tierNormaliser";
import { sendEmail } from "../email/emailService";
import { openclawSessionsService } from "../openclaw/openclawSessionsHandler";
import { IntegrationRepository } from "../integrations/integrationRepository";
import { IntegrationService } from "../integrations/integrationService";
import { AwsSecretsClient } from "../integrations/secretsClient";
import { WorkspaceConfigService } from "../workspace/workspaceConfigService";
import { syncWorkspaceAfterTierChange } from "../workspace/tierChangeSync";
import type { SubscriptionTier } from "../integrations/tierGate";

// Workspace-sync dependencies for the customer.subscription.updated
// tier-change path. Lazy-initialised (not constructed at module load)
// because:
//
//   - Hoisting interaction with vi.mock in tests: module-level
//     `new ProvisioningRepository()` runs before the test file's
//     captured-vars-in-mock-factories are initialised, throwing
//     `Cannot access 'mockX' before initialization`.
//   - Not every webhook event needs the workspace sync (checkout
//     creation, invoice failure, cancellation, etc.). Lazy
//     instantiation defers the cost to the one path that uses it.
//
// The shared `[workspace-sync]` log prefix keeps CloudWatch readable
// across this and the integration-handler call site (which has its
// own WorkspaceConfigService instance — separate pendingReloads
// sets, harmless).
const tierSyncLogger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(`[workspace-sync] ${msg}`, ctx ?? {}),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(`[workspace-sync] ${msg}`, ctx ?? {}),
};

let cachedTierSyncIntegrationService: IntegrationService | undefined;
let cachedTierSyncWorkspaceConfigService: WorkspaceConfigService | undefined;

function getTierSyncIntegrationService(): IntegrationService {
  if (!cachedTierSyncIntegrationService) {
    cachedTierSyncIntegrationService = new IntegrationService(
      new IntegrationRepository(),
      new AwsSecretsClient(),
    );
  }
  return cachedTierSyncIntegrationService;
}

function getTierSyncWorkspaceConfigService(): WorkspaceConfigService {
  if (!cachedTierSyncWorkspaceConfigService) {
    cachedTierSyncWorkspaceConfigService = new WorkspaceConfigService({
      provisioningRepo: new ProvisioningRepository(),
      logger: {
        info: tierSyncLogger.info,
        warn: tierSyncLogger.warn,
        error: (msg, ctx) =>
          console.error(`[workspace-sync] ${msg}`, ctx ?? {}),
      },
    });
  }
  return cachedTierSyncWorkspaceConfigService;
}

function getStripeInstance() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Set it via: sst secret set AxelSaasStripeSecretKey <key>",
    );
  }
  return new Stripe(secretKey);
}

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set. Set it via: sst secret set AxelSaasStripeWebhookSecret <secret>",
    );
  }
  return secret;
}

/**
 * Get the Stripe customer ID for an authenticated user
 * Returns null if user has no subscription or no Stripe customer
 */
async function getStripeCustomerIdForUser(
  supabaseUserId: string,
): Promise<string | null> {
  const db = getDb();
  const dbUser = await userRepository.getUserBySupabaseId(supabaseUserId);
  if (!dbUser) {
    return null;
  }

  const subRepo = new SubscriptionRepository(db);
  const subscription = await subRepo.findByUserId(dbUser.id);
  return subscription?.stripeCustomerId || null;
}

export const stripeHandler = new Elysia({ name: "StripeHandler" })
  .post("/stripe/create-checkout-session", async ({ body, headers, set }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const { tier } = body as { tier: string };
    if (tier !== "premium") {
      set.status = 400;
      return { error: "Invalid tier" };
    }

    const priceId = process.env.STRIPE_PRICE_PREMIUM || "";
    if (!priceId) {
      set.status = 500;
      return { error: "Price not configured for tier" };
    }

    const authUser = await getAuthUser(authHeader);
    if (!authUser) {
      set.status = 401;
      return { error: "Unauthorized" };
    }

    const dbUser = await userRepository.getUserBySupabaseId(authUser.sub);
    if (!dbUser) {
      set.status = 404;
      return { error: "User not found" };
    }

    const stripe = getStripeInstance();
    const db = getDb();
    const subRepo = new SubscriptionRepository(db);

    const existingSub = await subRepo.findByUserId(dbUser.id);
    let stripeCustomerId = existingSub?.stripeCustomerId ?? null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: dbUser.email,
        ...(dbUser.fullName && { name: dbUser.fullName }),
        metadata: { userId: dbUser.id, supabaseUserId: authUser.sub },
      });
      stripeCustomerId = customer.id;
    }

    const webUrl = process.env.VITE_WEB_URL || "http://localhost:5173";
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId: dbUser.id, tier },
      success_url: `${webUrl}/dashboard?checkout=success`,
      cancel_url: `${webUrl}/subscribe?checkout=cancelled`,
    });

    if (!session.url) {
      set.status = 500;
      return { error: "Checkout session URL unavailable" };
    }

    return { url: session.url };
  })
  .post("/stripe/webhook", async ({ body, headers, set }) => {
    const sig = headers["stripe-signature"];
    if (!sig) {
      set.status = 400;
      return { received: false };
    }

    let event: Stripe.Event;
    try {
      const stripe = getStripeInstance();
      event = stripe.webhooks.constructEvent(
        body as unknown as Buffer,
        sig,
        getWebhookSecret(),
      );
    } catch {
      set.status = 400;
      return { received: false };
    }

    const db = getDb();
    const subRepo = new SubscriptionRepository(db);
    const provRepo = new ProvisioningRepository(db);

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata as Record<string, string>;

        if (!session.customer || !metadata?.userId || !metadata?.tier) {
          throw new Error("Missing required metadata in checkout session");
        }

        const checkoutTier = normaliseTier(metadata.tier);
        if (!checkoutTier) {
          throw new Error(
            `Unrecognised tier '${metadata.tier}' in checkout session metadata`,
          );
        }

        await subRepo.upsertByStripeCustomerId({
          userId: metadata.userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          tier: checkoutTier,
          status: "active",
          currentPeriodEnd: session.expires_at
            ? new Date(session.expires_at * 1000)
            : undefined,
        });

        // Create provisioning state if it doesn't exist
        const existingProv = await provRepo.findByUserId(metadata.userId);
        if (!existingProv) {
          await provRepo.create({
            userId: metadata.userId,
            status: "pending",
          });
        }

        // Trigger container launch. Awaited so Lambda does not return before
        // the webhook fires and the status is persisted. Failure is best-effort:
        // we log and continue so Stripe receives 200 and does not retry the event.
        const workspacePath = resolveWorkspacePath(metadata.userId);

        try {
          await triggerContainerLaunch(provRepo, {
            userId: metadata.userId,
            tier: checkoutTier,
            workspacePath,
          });
        } catch (err: unknown) {
          console.error(
            `[provisioning] Failed to trigger container launch for user ${metadata.userId}:`,
            err,
          );
        }

        // Confirmation email — fire-and-forget. Never breaks the webhook.
        try {
          const user = await userRepository.findById(metadata.userId);
          if (user?.email) {
            void sendEmail({
              template: "subscription-confirmed",
              to: user.email,
              // `metadata.tier` may carry legacy values (starter/pro/business);
              // use the already-normalised value so the email matches the DB.
              data: { tier: checkoutTier },
            });
          }
        } catch (err: unknown) {
          console.error("[email] subscription-confirmed lookup failed:", err);
        }
      } else if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await subRepo.findByStripeCustomerId(
          subscription.customer as string,
        );

        if (sub) {
          // Extract tier from price metadata. Legacy prices may still carry
          // old 4-tier values (starter/pro/business/developer) — map them
          // via `normaliseTier` rather than casting blindly. An unrecognised
          // tier is logged and skipped; the current DB value is left alone
          // so the webhook still succeeds and Stripe doesn't retry-loop.
          const itemPrice = subscription.items.data[0]?.price;
          const rawTier = itemPrice?.metadata?.tier;
          if (rawTier) {
            const nextTier = normaliseTier(rawTier);
            if (nextTier) {
              const previousTier = sub.tier as SubscriptionTier | null;
              await subRepo.updateTier(sub.id, nextTier);

              // Tier-change workspace regen: when the tier actually
              // changes (not a noop write of the same value), refresh
              // every tier-sensitive workspace file so the running
              // container picks up the new tier on its next reload
              // rather than waiting for the user to re-onboard.
              //
              // Wrapped in try/catch because the Stripe event MUST
              // succeed (return 2xx) even if the workspace sync fails.
              // A retry storm on a transient EFS / DB hiccup would
              // re-fire every downstream subscription.updated handler
              // (period-end refresh, cancel-at-period-end flag, status
              // map) on each retry — none of which is idempotent in
              // any interesting way but all of which write to the DB
              // again. Stripe never sees the workspace failure.
              //
              // The catch is BROAD on purpose. Unlike the
              // stopAllForUser path (which has its own narrow
              // loader-throw guard for the SSM-not-deployed signal),
              // none of the workspace-sync failure modes (EFS write
              // error, DB read failure on onboarding answers,
              // integration list failure) justify a Stripe retry —
              // the tier is already DB-updated; replaying the event
              // wouldn't change the workspace outcome.
              //
              // ## Recovery story when this catch fires
              //
              // Inspector PR #115 caught that the original comment
              // here described a recovery path that doesn't exist:
              //
              //   - "No-op tier write re-triggers" is FALSE. The sync
              //     is inside the `nextTier !== previousTier` guard;
              //     a replay of the same Stripe event (or any
              //     subscription.updated with the same tier) skips
              //     the sync entirely. To genuinely re-trigger from
              //     Stripe you'd need to change price metadata to a
              //     DIFFERENT tier and back.
              //   - "Next /connect or /revoke overwrites" only
              //     refreshes TOOLS.md + openclaw.json (the two files
              //     `integrationsSync.ts` writes). It does NOT touch
              //     AGENTS.md or SOUL.md — both are tier-only and
              //     stay stale until a real tier transition.
              //
              // So on failure: AGENTS.md and SOUL.md are stale for
              // the affected user until the next genuine tier change.
              // For an MVP this is acceptable (we ack Stripe + log
              // structured); a future admin re-trigger endpoint that
              // skips the equality guard is the right follow-up if
              // failures become frequent enough to warrant it.
              if (nextTier !== previousTier) {
                try {
                  await syncWorkspaceAfterTierChange(
                    {
                      userRepository,
                      integrationService: getTierSyncIntegrationService(),
                      workspaceConfigService:
                        getTierSyncWorkspaceConfigService(),
                      logger: tierSyncLogger,
                    },
                    sub.userId,
                    nextTier,
                  );
                  tierSyncLogger.info(
                    "subscription.updated: workspace regen complete",
                    {
                      userId: sub.userId,
                      previousTier,
                      nextTier,
                    },
                  );
                } catch (err) {
                  // Structured log carrying everything an operator
                  // needs to manually re-trigger:
                  //   - userId   → which user is affected
                  //   - previousTier / nextTier → which transition
                  //   - subscriptionId → the row to inspect
                  //   - the raw error → root cause for fix
                  // No automatic recovery; see comment above for why
                  // this is acceptable for MVP and what to add when
                  // it isn't.
                  console.error(
                    "[stripe] subscription.updated: workspace regen failed; AGENTS.md/SOUL.md stale until next REAL tier change (no-op tier writes will not re-trigger)",
                    {
                      userId: sub.userId,
                      subscriptionId: sub.id,
                      previousTier,
                      nextTier,
                      error: err instanceof Error ? err.message : String(err),
                    },
                  );
                }
              }
            } else {
              console.warn(
                `[stripe] subscription.updated: ignoring unrecognised tier '${rawTier}' on price ${itemPrice?.id ?? "unknown"} for subscription ${sub.id}`,
              );
            }
          }

          if (subscription.current_period_end) {
            await subRepo.updatePeriodEnd(
              sub.id,
              new Date(subscription.current_period_end * 1000),
            );
          }

          const statusMap: Record<
            string,
            (typeof subscriptionStatusEnum.enumValues)[number]
          > = {
            active: "active",
            trialing: "trialing",
            past_due: "past_due",
            canceled: "cancelled",
            incomplete: "incomplete",
          };

          const newStatus = statusMap[subscription.status] || sub.status;
          if (newStatus !== sub.status) {
            await subRepo.updateStatus(sub.id, newStatus);
          }

          // Stripe portal cancellations send updated (status=active,
          // cancel_at_period_end=true) and only fire `deleted` when the
          // period actually ends. Persist the flag so the UI can render
          // "Cancellation scheduled" instead of "Renews [date]". Reverting
          // a cancellation in the portal flips it back to false in the same
          // event type.
          const nextCancelAtPeriodEnd = !!subscription.cancel_at_period_end;
          if (nextCancelAtPeriodEnd !== sub.cancelAtPeriodEnd) {
            await subRepo.updateCancelAtPeriodEnd(
              sub.id,
              nextCancelAtPeriodEnd,
            );
          }
        }
      } else if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await subRepo.findByStripeCustomerId(
          subscription.customer as string,
        );

        if (sub) {
          await subRepo.updateStatus(sub.id, "cancelled");
          // Clear cancel_at_period_end now that the cancellation has
          // landed — the flag was meaningful while pending, but a row
          // with status="cancelled" is no longer "scheduled to cancel".
          // Keeps state consistent if the user later resubscribes.
          if (sub.cancelAtPeriodEnd) {
            await subRepo.updateCancelAtPeriodEnd(sub.id, false);
          }

          // Tear down active OpenClaw sessions for the cancelled user
          // per spec §10. We DO NOT delete the EFS access points here
          // — keeping the user's workspace intact across resubscriptions
          // matches the "stopped → restart on same name" behaviour
          // for the sessions themselves.
          //
          // No inner try/catch: partial AWS failures during teardown
          // are returned via `summary.failed` (the service catches
          // per-row errors), so they're already logged-not-thrown
          // and won't trigger a Stripe retry storm. The only thing
          // that DOES throw from stopAllForUser is "couldn't make
          // any progress" (loadInfra hit a transient SSM error, DB
          // unreachable, etc.) — exactly the case where we WANT
          // Stripe to retry the whole event. An earlier inner catch
          // here swallowed that signal too, silently leaving rows
          // active + AWS resources running until manual cleanup
          // (inspector PR #110 round 3).
          const summary = await openclawSessionsService.stopAllForUser(
            sub.userId,
            "tier_change",
          );
          if (summary.stopped > 0 || summary.failed > 0) {
            console.log(
              `[stripe] subscription.deleted: openclaw teardown — stopped=${summary.stopped} failed=${summary.failed} (user ${sub.userId})`,
            );
          }

          // Cancellation email — fire-and-forget. The template reads
          // `endsAt` (the period the user keeps access until); if Stripe
          // didn't supply `current_period_end`, omit the field and let
          // the template render its generic fallback.
          try {
            const user = await userRepository.findById(sub.userId);
            if (user?.email) {
              const data: Record<string, string> = {};
              if (subscription.current_period_end) {
                data.endsAt = new Date(
                  subscription.current_period_end * 1000,
                ).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                });
              }
              void sendEmail({
                template: "subscription-cancelled",
                to: user.email,
                data,
              });
            }
          } catch (err: unknown) {
            console.error("[email] subscription-cancelled lookup failed:", err);
          }
        }
      } else if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await subRepo.findByStripeCustomerId(
          invoice.customer as string,
        );

        if (sub) {
          await subRepo.updateStatus(sub.id, "past_due");

          // Payment failure email — fire-and-forget. The template reads
          // `billingUrl` (with a sensible default); no payload needed.
          try {
            const user = await userRepository.findById(sub.userId);
            if (user?.email) {
              void sendEmail({
                template: "payment-failed",
                to: user.email,
                data: {},
              });
            }
          } catch (err: unknown) {
            console.error("[email] payment-failed lookup failed:", err);
          }
        }
      }

      return { received: true };
    } catch (err) {
      console.error("Webhook processing error:", err);
      set.status = 500;
      return { received: false };
    }
  })
  // Invoice endpoints - require verified authentication via Supabase JWKS
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get("/stripe/invoices", async (ctx) => {
    const { query, set } = ctx;
    const { sub: supabaseUserId } = getUser(ctx);

    const stripeCustomerId = await getStripeCustomerIdForUser(supabaseUserId);
    if (!stripeCustomerId) {
      set.status = 404;
      return { success: false, error: "No subscription found" };
    }

    const rawLimit = parseInt(query.limit as string);
    if (!Number.isNaN(rawLimit) && rawLimit < 1) {
      set.status = 400;
      return { success: false, error: "limit must be a positive integer" };
    }
    const limit = Number.isNaN(rawLimit) ? 10 : Math.min(rawLimit, 100);

    const startingAfter = (query.starting_after as string) || undefined;

    const stripe = getStripeInstance();

    try {
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit,
        ...(startingAfter && { starting_after: startingAfter }),
        expand: ["data.payment_intent"],
      });

      return {
        success: true,
        invoices: invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amountDue: inv.amount_due,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          created: inv.created,
          dueDate: inv.due_date,
          invoicePdf: inv.invoice_pdf,
          hostedInvoiceUrl: inv.hosted_invoice_url,
          periodStart: inv.period_start,
          periodEnd: inv.period_end,
        })),
        hasMore: invoices.has_more,
        nextCursor: invoices.has_more
          ? (invoices.data[invoices.data.length - 1]?.id ?? null)
          : null,
      };
    } catch (err) {
      console.error("List invoices error:", err);
      set.status = 500;
      return { success: false, error: "Failed to fetch invoices" };
    }
  })
  .get("/stripe/invoices/:id", async (ctx) => {
    const { params, set } = ctx;
    const { sub: supabaseUserId } = getUser(ctx);

    const stripeCustomerId = await getStripeCustomerIdForUser(supabaseUserId);
    if (!stripeCustomerId) {
      set.status = 404;
      return { success: false, error: "No subscription found" };
    }

    const stripe = getStripeInstance();

    try {
      const invoice = await stripe.invoices.retrieve(params.id, {
        expand: ["payment_intent", "lines"],
      });

      // Verify the invoice belongs to this customer
      if (invoice.customer !== stripeCustomerId) {
        set.status = 403;
        return {
          success: false,
          error: "Invoice does not belong to this user",
        };
      }

      return {
        success: true,
        invoice: {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amountDue: invoice.amount_due,
          amountPaid: invoice.amount_paid,
          amountRemaining: invoice.amount_remaining,
          currency: invoice.currency,
          created: invoice.created,
          dueDate: invoice.due_date,
          invoicePdf: invoice.invoice_pdf,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
          periodStart: invoice.period_start,
          periodEnd: invoice.period_end,
          customer: invoice.customer,
          subscription: invoice.subscription,
          lines: invoice.lines?.data.map((line) => ({
            id: line.id,
            description: line.description,
            amount: line.amount,
            quantity: line.quantity,
            unitAmount: line.price?.unit_amount ?? null,
            period: {
              start: line.period?.start,
              end: line.period?.end,
            },
          })),
        },
      };
    } catch (err) {
      console.error("Get invoice error:", err);
      if (
        (err as Stripe.errors.StripeError).type === "StripeInvalidRequestError"
      ) {
        set.status = 404;
        return { success: false, error: "Invoice not found" };
      }
      set.status = 500;
      return { success: false, error: "Failed to fetch invoice" };
    }
  })
  .post("/stripe/customer-portal", async (ctx) => {
    const { body, set } = ctx;
    const { sub: supabaseUserId } = getUser(ctx);

    const db = getDb();
    const dbUser = await userRepository.getUserBySupabaseId(supabaseUserId);
    if (!dbUser) {
      set.status = 404;
      return { success: false, error: "User not found" };
    }

    const subRepo = new SubscriptionRepository(db);
    const subscription = await subRepo.findByUserId(dbUser.id);
    if (!subscription?.stripeCustomerId) {
      // Free-tier users have no Stripe customer to manage. The frontend
      // should hide the "Manage subscription" CTA in that case; this 404
      // is a defensive check for clients that call anyway.
      set.status = 404;
      return { success: false, error: "No Stripe customer for this user" };
    }

    const flow = (body as { flow?: string } | null)?.flow;
    if (flow && flow !== "cancel") {
      set.status = 400;
      return { success: false, error: "Unsupported flow" };
    }

    const stripe = getStripeInstance();
    const webUrl = process.env.VITE_WEB_URL || "http://localhost:5173";
    const returnUrl = `${webUrl}/dashboard/settings`;

    try {
      const params: Stripe.BillingPortal.SessionCreateParams = {
        customer: subscription.stripeCustomerId,
        return_url: returnUrl,
      };
      if (flow === "cancel" && subscription.stripeSubscriptionId) {
        params.flow_data = {
          type: "subscription_cancel",
          subscription_cancel: {
            subscription: subscription.stripeSubscriptionId,
          },
        };
      }

      const session = await stripe.billingPortal.sessions.create(params);

      if (!session.url) {
        set.status = 500;
        return {
          success: false,
          error: "Stripe did not return a portal URL",
        };
      }

      return { success: true, url: session.url };
    } catch (err) {
      console.error("Create customer portal session error:", err);
      set.status = 500;
      return { success: false, error: "Failed to open billing portal" };
    }
  });
