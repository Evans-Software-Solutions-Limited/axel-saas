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

const tiers = [
  {
    id: "starter",
    name: "Starter",
    priceGbpMonthly: 19,
    features: ["Daily brief", "Telegram", "Basic tasks", "Email triage"],
  },
  {
    id: "pro",
    name: "Pro",
    priceGbpMonthly: 49,
    features: [
      "Everything in Starter",
      "Calendar",
      "Email send/receive",
      "Integrations",
      "Sub-agents",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceGbpMonthly: 99,
    features: [
      "Everything in Pro",
      "Custom channels",
      "Multiple agents",
      "Priority support",
    ],
  },
  {
    id: "developer",
    name: "Developer",
    priceGbpMonthly: 149,
    features: [
      "Everything in Business",
      "Full exec access",
      "Code generation",
      "API access",
      "Heavy sub-agent use",
    ],
  },
];

// Public — no auth required
export const subscriptionPublicHandler = new Elysia({
  name: "SubscriptionPublicHandler",
}).get("/subscriptions/tiers", () => tiers, {
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
    "/subscriptions/checkout",
    async (ctx) => {
      const { body, set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const { tierId } = body;
      if (!["starter", "pro", "business", "developer"].includes(tierId)) {
        set.status = 400;
        return { success: false, error: "Invalid tier" };
      }

      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) {
        set.status = 500;
        return { success: false, error: "Stripe not configured" };
      }

      const priceMap: Record<string, string> = {
        starter: process.env.STRIPE_PRICE_STARTER || "",
        pro: process.env.STRIPE_PRICE_PRO || "",
        business: process.env.STRIPE_PRICE_BUSINESS || "",
        developer: process.env.STRIPE_PRICE_DEVELOPER || "",
      };

      const priceId = priceMap[tierId];
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
