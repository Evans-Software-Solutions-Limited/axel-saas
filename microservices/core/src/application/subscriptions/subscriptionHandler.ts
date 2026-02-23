import Elysia from "elysia";

export const subscriptionHandler = new Elysia({
  name: "SubscriptionHandler",
}).get(
  "/subscriptions/tiers",
  () => {
    return [
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
  },
  {
    detail: {
      description: "Get subscription tier definitions",
      tags: ["Subscriptions"],
    },
  },
);
