import Elysia, { t } from "elysia";
import Stripe from "stripe";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { UserRepository } from "../repositories/userRepository";

export const TIERS = [
  {
    id: "free",
    name: "Free",
    priceGbpMonthly: 0,
    selfServe: true,
    features: [
      "Core Axel experience",
      "Daily usage caps",
      "7-day Premium trial",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceGbpMonthly: 49,
    selfServe: true,
    features: [
      "Everything in Free, without the caps",
      "Bring your own model (BYOM)",
      "Deeper integrations",
      "Higher volume",
      "Cancel any time",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceGbpMonthly: null,
    selfServe: false,
    features: [
      "SSO and audit logs",
      "SLA options",
      "Custom retention",
      "Dedicated support",
    ],
  },
] as const;

/** Tier IDs that can be checked out via self-serve Stripe checkout. */
const CHECKOUT_TIERS = ["premium"] as const;
type CheckoutTier = (typeof CHECKOUT_TIERS)[number];

// Public — no auth required
export const subscriptionPublicHandler = new Elysia({
  name: "SubscriptionPublicHandler",
}).get("/subscriptions/tiers", () => TIERS, {
  detail: {
    description: "Get subscription tier definitions",
    tags: ["Subscriptions"],
  },
});

// Protected — auth required
export const subscriptionHandler = new Elysia({
  name: "SubscriptionHandler",
})
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/subscriptions/status",
    async (ctx) => {
      const { set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const subRepo = new SubscriptionRepository(db);
      const subscription = await subRepo.findByUserId(dbUser.id);

      if (!subscription) {
        return { success: true, subscription: null };
      }

      return {
        success: true,
        subscription: {
          tier: subscription.tier,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      };
    },
    {
      detail: {
        description: "Get current user subscription status",
        tags: ["Subscriptions"],
      },
    },
  )
  .post(
    "/subscriptions/free",
    async (ctx) => {
      const { set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const subRepo = new SubscriptionRepository(db);
      const subscription = await subRepo.createFreeSubscription(dbUser.id);

      return {
        success: true,
        subscription: {
          tier: subscription.tier,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      };
    },
    {
      detail: {
        description:
          "Idempotently provision a free-tier subscription for the authenticated user. Returns the existing row unchanged if any subscription already exists.",
        tags: ["Subscriptions"],
      },
    },
  )
  .post(
    "/subscriptions/checkout",
    async (ctx) => {
      const { body, set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const { tierId } = body;
      if (!(CHECKOUT_TIERS as readonly string[]).includes(tierId)) {
        set.status = 400;
        return { success: false, error: "Invalid tier" };
      }

      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        set.status = 500;
        return { success: false, error: "Stripe not configured" };
      }

      const priceMap: Record<CheckoutTier, string> = {
        premium: process.env.STRIPE_PRICE_PREMIUM || "",
      };

      const priceId = priceMap[tierId as CheckoutTier];
      if (!priceId) {
        set.status = 500;
        return { success: false, error: "Price not configured for tier" };
      }

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const stripe = new Stripe(secretKey);
      const subRepo = new SubscriptionRepository(db);
      const existingSub = await subRepo.findByUserId(dbUser.id);
      let stripeCustomerId = existingSub?.stripeCustomerId ?? null;

      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: dbUser.email,
          ...(dbUser.fullName && { name: dbUser.fullName }),
          metadata: { userId: dbUser.id, supabaseUserId },
        });
        stripeCustomerId = customer.id;
      }

      const webUrl = process.env.VITE_WEB_URL || "http://localhost:5173";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { userId: dbUser.id, tier: tierId },
        success_url: `${webUrl}/dashboard?checkout=success`,
        cancel_url: `${webUrl}/subscribe?checkout=cancelled`,
      });

      if (!session.url) {
        set.status = 500;
        return {
          success: false,
          error: "Stripe did not return a checkout URL",
        };
      }

      return { success: true, url: session.url };
    },
    {
      body: t.Object({
        tierId: t.String(),
      }),
      detail: {
        description: "Initiate subscription checkout",
        tags: ["Subscriptions"],
      },
    },
  );
