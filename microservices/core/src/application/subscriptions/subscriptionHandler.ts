import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";

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
  .post(
    "/subscriptions/checkout",
    async (ctx) => {
      const { body } = ctx;
      const { sub } = getUser(ctx);

      // TODO: Integrate with Stripe to create a checkout session
      return {
        success: true,
        message: "Checkout initiated (Stripe integration coming soon)",
        tierId: body.tierId,
        userId: sub,
      };
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
