import Elysia from "elysia";
import { t } from "elysia";
import { jwtVerify } from "jose";

function getJwtSecret(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resource } = require("sst");
    if (Resource.AxelSaasJwtSecret?.value) {
      return Resource.AxelSaasJwtSecret.value;
    }
  } catch {
    // Resource not available, fall through to env var
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Set it via: sst secret set AxelSaasJwtSecret <secret>",
    );
  }
  return secret;
}

async function getAuthUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload as { sub: string; email: string };
  } catch {
    return null;
  }
}

export const subscriptionHandler = new Elysia({
  name: "SubscriptionHandler",
})
  .get(
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
  )
  .post(
    "/subscriptions/checkout",
    async ({ body, headers, set }) => {
      const authUser = await getAuthUser(headers.authorization);
      if (!authUser?.sub) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      // TODO: Integrate with Stripe to create checkout session
      // For now, return success and frontend will redirect to dashboard
      return {
        success: true,
        message: "Checkout initiated (Stripe integration coming soon)",
        tierId: body.tierId,
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
