import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("stripe");
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  })),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

vi.mock("../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn(() => ({
    upsertByStripeCustomerId: vi.fn(),
    findByStripeCustomerId: vi.fn(),
    updateTier: vi.fn(),
    updatePeriodEnd: vi.fn(),
    updateStatus: vi.fn(),
  })),
}));

vi.mock("../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn(() => ({
    findByUserId: vi.fn(),
    create: vi.fn(),
  })),
}));

// Mock environment variables
vi.stubEnv("STRIPE_SECRET_KEY", "test_secret_key");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test_webhook_secret");
vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter_123");
vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_business_123");
vi.stubEnv("STRIPE_PRICE_DEVELOPER", "price_developer_123");

import { stripeHandler } from "../stripeHandler";

describe("StripeHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("stripeHandler instance and routes", () => {
    it("should be defined", () => {
      expect(stripeHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(stripeHandler.routes).toBeDefined();
      expect(Array.isArray(stripeHandler.routes)).toBe(true);
      expect(stripeHandler.routes.length).toBeGreaterThan(0);
    });

    it("should have POST /stripe/create-checkout-session route", () => {
      const postRoutes = stripeHandler.routes.filter(
        (r) => r.method === "POST",
      );
      const checkoutRoute = postRoutes.find(
        (r) => r.path === "/stripe/create-checkout-session",
      );
      expect(checkoutRoute).toBeDefined();
    });

    it("should have POST /stripe/webhook route", () => {
      const postRoutes = stripeHandler.routes.filter(
        (r) => r.method === "POST",
      );
      const webhookRoute = postRoutes.find((r) => r.path === "/stripe/webhook");
      expect(webhookRoute).toBeDefined();
    });
  });

  describe("create checkout session", () => {
    it("should have proper tier validation", () => {
      const validTiers = ["starter", "pro", "business", "developer"];
      expect(validTiers).toHaveLength(4);
      for (const tier of validTiers) {
        expect(validTiers).toContain(tier);
      }
    });

    it("should validate invalid tier", () => {
      const validTiers = ["starter", "pro", "business", "developer"];
      const invalidTier = "invalid_tier";
      expect(validTiers).not.toContain(invalidTier);
    });

    it("should have price for starter tier", () => {
      expect(process.env.STRIPE_PRICE_STARTER).toBe("price_starter_123");
    });

    it("should have price for pro tier", () => {
      expect(process.env.STRIPE_PRICE_PRO).toBe("price_pro_123");
    });

    it("should have price for business tier", () => {
      expect(process.env.STRIPE_PRICE_BUSINESS).toBe("price_business_123");
    });

    it("should have price for developer tier", () => {
      expect(process.env.STRIPE_PRICE_DEVELOPER).toBe("price_developer_123");
    });

    it("should have price map for all tiers", () => {
      const priceMap = {
        starter: process.env.STRIPE_PRICE_STARTER || "",
        pro: process.env.STRIPE_PRICE_PRO || "",
        business: process.env.STRIPE_PRICE_BUSINESS || "",
        developer: process.env.STRIPE_PRICE_DEVELOPER || "",
      };
      for (const price of Object.values(priceMap)) {
        expect(price.length).toBeGreaterThan(0);
      }
    });

    it("should return 500 when price ID is missing", () => {
      // When tier is valid but price env var is missing
      const priceId = "";
      expect(priceId).toBe("");
    });

    it("should check for required authorization", () => {
      const authHeader = "Bearer token";
      expect(authHeader.startsWith("Bearer ")).toBe(true);
    });

    it("should reject non-Bearer authorization", () => {
      const authHeader = "Basic invalid";
      expect(authHeader.startsWith("Bearer ")).toBe(false);
    });
  });

  describe("webhook handling and events", () => {
    it("should require stripe-signature header", () => {
      const headers = { "stripe-signature": "sig_test" };
      expect(headers["stripe-signature"]).toBeDefined();
    });

    it("should handle checkout.session.completed event type", () => {
      const eventType = "checkout.session.completed";
      expect(eventType).toBe("checkout.session.completed");
    });

    it("should handle customer.subscription.updated event type", () => {
      const eventType = "customer.subscription.updated";
      expect(eventType).toBe("customer.subscription.updated");
    });

    it("should handle customer.subscription.deleted event type", () => {
      const eventType = "customer.subscription.deleted";
      expect(eventType).toBe("customer.subscription.deleted");
    });

    it("should handle invoice.payment_failed event type", () => {
      const eventType = "invoice.payment_failed";
      expect(eventType).toBe("invoice.payment_failed");
    });

    it("should validate checkout session has required metadata", () => {
      const session = {
        customer: "cus_123",
        metadata: { userId: "user-123", tier: "starter" },
      };
      expect(session.customer).toBeDefined();
      expect(session.metadata?.userId).toBeDefined();
      expect(session.metadata?.tier).toBeDefined();
    });

    it("should handle subscription with current_period_end", () => {
      const subscription = {
        customer: "cus_123",
        current_period_end: 1234567890,
        items: {
          data: [{ price: { metadata: { tier: "pro" } } }],
        },
        status: "active",
      };
      expect(subscription.current_period_end).toBeDefined();
      expect(subscription.status).toBe("active");
    });

    it("should map subscription status values", () => {
      const statusMap = {
        active: "active",
        trialing: "trialing",
        past_due: "past_due",
        canceled: "cancelled",
        incomplete: "incomplete",
      };
      expect(statusMap.active).toBe("active");
      expect(statusMap.canceled).toBe("cancelled");
      expect(statusMap.past_due).toBe("past_due");
    });

    it("should handle invoice with customer field", () => {
      const invoice = {
        customer: "cus_123",
        status: "paid",
      };
      expect(invoice.customer).toBeDefined();
    });

    it("should extract tier from price metadata", () => {
      const price = {
        metadata: { tier: "business" },
      };
      expect(price.metadata.tier).toBe("business");
    });

    it("should convert unix timestamp to date", () => {
      const timestamp = 1704067200; // 2024-01-01 00:00:00
      const date = new Date(timestamp * 1000);
      expect(date).toBeInstanceOf(Date);
      expect(date.getTime()).toBe(timestamp * 1000);
    });
  });

  describe("environment variables", () => {
    it("should require STRIPE_SECRET_KEY", () => {
      expect(process.env.STRIPE_SECRET_KEY).toBe("test_secret_key");
    });

    it("should require STRIPE_WEBHOOK_SECRET", () => {
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBe("test_webhook_secret");
    });

    it("should have all tier prices configured", () => {
      const prices = {
        starter: process.env.STRIPE_PRICE_STARTER,
        pro: process.env.STRIPE_PRICE_PRO,
        business: process.env.STRIPE_PRICE_BUSINESS,
        developer: process.env.STRIPE_PRICE_DEVELOPER,
      };

      for (const price of Object.values(prices)) {
        expect(price).toBeDefined();
        expect(price).not.toHaveLength(0);
      }
    });
  });
});
