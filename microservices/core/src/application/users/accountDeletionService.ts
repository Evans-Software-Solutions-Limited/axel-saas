/**
 * Orchestrates the multi-step account-deletion flow.
 *
 * Order matters here. Stripe is cancelled FIRST so a partial failure
 * leaves the user in an "account exists, subscription cancelled" state
 * rather than "account gone, still being charged". The DB row is
 * removed next (cascading every owned table via FK ON DELETE CASCADE),
 * and the Supabase auth row is removed last so a transient auth-API
 * outage doesn't strand the user with auth.users still present but no
 * application row — they'd be locked into a perpetual 404 loop on
 * /users/me.
 *
 * The service takes only `supabaseUserId` and looks up the application
 * user internally so the orphan-cleanup retry path is owned in one
 * place. If the DB row is already gone (e.g. a prior call cascaded the
 * DB rows but the auth-admin call timed out), the service still runs
 * `deleteAuthUser` so a re-trigger of `DELETE /users/me` finishes the
 * job. `deleteAuthUser` itself treats a 404 as success, so a third
 * retry after both layers are clean still returns a clean result.
 */

import Stripe from "stripe";
import {
  type DeleteAuthUserResult,
  deleteAuthUser as deleteAuthUserDefault,
} from "@axel-saas/api-utils/auth/supabaseAdmin";
import type { UserRepository } from "../repositories/userRepository";
import type { SubscriptionRepository } from "../repositories/subscriptionRepository";

export interface AccountDeletionDeps {
  userRepo: UserRepository;
  subscriptionRepo: SubscriptionRepository;
  /** Optional Stripe client. Falls back to a real client lazily so unit
   * tests don't need STRIPE_SECRET_KEY in env. */
  stripe?: Pick<Stripe, "subscriptions">;
  /** Override for tests. Defaults to the real Supabase admin REST call. */
  deleteAuthUser?: (supabaseUserId: string) => Promise<DeleteAuthUserResult>;
  logger?: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}

export interface DeleteAccountResult {
  success: boolean;
  /** Reason a non-success result was returned. The handler maps these to
   * HTTP status codes; the caller never sees an internal error string. */
  reason?: "stripe_cancel_failed" | "db_delete_failed" | "auth_delete_failed";
  details?: string;
  /** True when the application DB row was already gone before this call
   * (the orphan-cleanup / idempotent retry path). The handler doesn't
   * need this for status mapping — it's surfaced for telemetry. */
  orphanCleanup?: boolean;
}

const DEFAULT_LOGGER: Required<AccountDeletionDeps>["logger"] = {
  info: (msg, ctx) => console.log(`[account-delete] ${msg}`, ctx ?? {}),
  warn: (msg, ctx) => console.warn(`[account-delete] ${msg}`, ctx ?? {}),
  error: (msg, ctx) => console.error(`[account-delete] ${msg}`, ctx ?? {}),
};

function getStripeLazily(): Pick<Stripe, "subscriptions"> | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

export class AccountDeletionService {
  private deps: AccountDeletionDeps;
  private logger: Required<AccountDeletionDeps>["logger"];

  constructor(deps: AccountDeletionDeps) {
    this.deps = deps;
    this.logger = deps.logger ?? DEFAULT_LOGGER;
  }

  async deleteAccount(input: {
    supabaseUserId: string;
  }): Promise<DeleteAccountResult> {
    const { supabaseUserId } = input;
    const { userRepo, subscriptionRepo } = this.deps;

    // Look up the application user by their Supabase auth id. A null
    // result is the orphan-cleanup case: the DB row was already removed
    // by a prior partial-failure attempt. We skip Stripe + DB and go
    // straight to the auth-admin call so the auth.users row doesn't
    // stay orphaned forever.
    const dbUser = await userRepo.getUserBySupabaseId(supabaseUserId);
    const orphanCleanup = dbUser === null;

    if (dbUser !== null) {
      // 1. Cancel Stripe subscription (best-effort — premium only).
      const subscription = await subscriptionRepo.findByUserId(dbUser.id);
      if (subscription?.stripeSubscriptionId) {
        const stripe = this.deps.stripe ?? getStripeLazily();
        if (!stripe) {
          // No Stripe key available. Treat as soft failure: the user
          // will continue to be billed until the subscription is
          // cancelled out of band, but keeping the account would be
          // worse — log loudly and continue. The webhook handler still
          // owns the eventual cleanup if the subscription is cancelled
          // later.
          this.logger.warn("stripe_secret_unavailable_skipping_cancel", {
            userId: dbUser.id,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
          });
        } else {
          try {
            await stripe.subscriptions.cancel(
              subscription.stripeSubscriptionId,
            );
          } catch (err: unknown) {
            // A 404 from Stripe means the subscription is already gone
            // (e.g. cancelled out of band) — treat as success and
            // continue. Anything else is fatal: deleting the DB user
            // while still billing them is the worst possible outcome.
            const stripeErr = err as {
              code?: string;
              statusCode?: number;
              message?: string;
            };
            const alreadyGone =
              stripeErr.code === "resource_missing" ||
              stripeErr.statusCode === 404;
            if (!alreadyGone) {
              this.logger.error("stripe_cancel_failed", {
                userId: dbUser.id,
                stripeSubscriptionId: subscription.stripeSubscriptionId,
                error: stripeErr.message,
              });
              return {
                success: false,
                reason: "stripe_cancel_failed",
                details: stripeErr.message,
              };
            }
            this.logger.info("stripe_subscription_already_gone", {
              userId: dbUser.id,
              stripeSubscriptionId: subscription.stripeSubscriptionId,
            });
          }
        }
      }

      // 2. Delete the application user row (cascades all owned tables).
      try {
        const deleted = await userRepo.deleteById(dbUser.id);
        if (!deleted) {
          // Lost a race to a concurrent delete — treat as orphan-cleanup
          // and continue. The auth row may still be present.
          this.logger.info("db_row_already_deleted", { userId: dbUser.id });
        }
      } catch (err: unknown) {
        this.logger.error("db_delete_failed", {
          userId: dbUser.id,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          success: false,
          reason: "db_delete_failed",
          details: err instanceof Error ? err.message : String(err),
        };
      }
    } else {
      this.logger.info("orphan_auth_cleanup", { supabaseUserId });
    }

    // 3. Remove the Supabase auth row. Always runs — both for the
    // happy path and for the orphan-cleanup retry path. `deleteAuthUser`
    // is itself idempotent (treats 404 as already-removed).
    const authDelete = this.deps.deleteAuthUser ?? deleteAuthUserDefault;
    const authResult = await authDelete(supabaseUserId);
    if (!authResult.success) {
      this.logger.error("auth_delete_failed", {
        userId: dbUser?.id ?? null,
        supabaseUserId,
        status: authResult.status,
        error: authResult.error,
      });
      return {
        success: false,
        reason: "auth_delete_failed",
        details: authResult.error,
        ...(orphanCleanup && { orphanCleanup: true }),
      };
    }

    this.logger.info("account_deleted", {
      userId: dbUser?.id ?? null,
      authAlreadyRemoved: authResult.alreadyRemoved === true,
      orphanCleanup,
    });
    return {
      success: true,
      ...(orphanCleanup && { orphanCleanup: true }),
    };
  }
}
