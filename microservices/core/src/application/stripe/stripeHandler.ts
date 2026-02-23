import Elysia from "elysia";
import Stripe from "stripe";
import { getDb, subscriptionStatusEnum } from "@axel-saas/db";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { ProvisioningRepository } from "../repositories/provisioningRepository";

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

export const stripeHandler = new Elysia({ name: "StripeHandler" })
  .post("/stripe/create-checkout-session", async ({ body, headers, set }) => {
    // Get user from context (injected by supabaseAuth middleware)
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      return { received: false };
    }

    const { tier } = body as { tier: string };
    if (!["starter", "pro", "business", "developer"].includes(tier)) {
      set.status = 400;
      return { received: false };
    }

    const priceMap: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER || "",
      pro: process.env.STRIPE_PRICE_PRO || "",
      business: process.env.STRIPE_PRICE_BUSINESS || "",
      developer: process.env.STRIPE_PRICE_DEVELOPER || "",
    };

    const priceId = priceMap[tier];
    if (!priceId) {
      set.status = 500;
      return { received: false };
    }

    set.status = 500;
    return { received: false };
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

        await subRepo.upsertByStripeCustomerId({
          userId: metadata.userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          tier: metadata.tier as "starter" | "pro" | "business" | "developer",
          status: "active",
          currentPeriodEnd: session.expires_at
            ? new Date(session.expires_at * 1000)
            : undefined,
        });

        // Create provisioning state
        const existingProv = await provRepo.findByUserId(metadata.userId);
        if (!existingProv) {
          await provRepo.create({
            userId: metadata.userId,
            status: "pending",
          });
        }
      } else if (event.type === "customer.subscription.updated") {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await subRepo.findByStripeCustomerId(
          subscription.customer as string,
        );

        if (sub) {
          // Extract tier from metadata or price ID
          const itemPrice = subscription.items.data[0]?.price;
          if (itemPrice?.metadata?.tier) {
            await subRepo.updateTier(
              sub.id,
              itemPrice.metadata.tier as
                | "starter"
                | "pro"
                | "business"
                | "developer",
            );
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
        }
      } else if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object as Stripe.Subscription;
        const sub = await subRepo.findByStripeCustomerId(
          subscription.customer as string,
        );

        if (sub) {
          await subRepo.updateStatus(sub.id, "cancelled");
        }
      } else if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = await subRepo.findByStripeCustomerId(
          invoice.customer as string,
        );

        if (sub) {
          await subRepo.updateStatus(sub.id, "past_due");
        }
      }

      return { received: true };
    } catch (err) {
      console.error("Webhook processing error:", err);
      set.status = 500;
      return { received: false };
    }
  });
