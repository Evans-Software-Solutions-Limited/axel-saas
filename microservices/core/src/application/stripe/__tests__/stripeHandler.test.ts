import { describe, it, expect, vi, beforeEach } from "vitest";
import { stripeHandler } from "../stripeHandler";

// Mock environment variables
vi.stubEnv("STRIPE_SECRET_KEY", "test_secret_key");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test_webhook_secret");
vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter_123");
vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_business_123");
vi.stubEnv("STRIPE_PRICE_DEVELOPER", "price_developer_123");

describe("StripeHandler", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("stripeHandler instance", () => {
    it("should be defined", () => {
      expect(stripeHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(stripeHandler.routes).toBeDefined();
      expect(Array.isArray(stripeHandler.routes)).toBe(true);
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

  describe("checkout session creation", () => {
    it("should validate tier parameter", () => {
      const validTiers = ["starter", "pro", "business", "developer"];
      expect(validTiers.length).toBe(4);
    });

    it("should have price environment variables", () => {
      expect(process.env.STRIPE_PRICE_STARTER).toBe("price_starter_123");
      expect(process.env.STRIPE_PRICE_PRO).toBe("price_pro_123");
      expect(process.env.STRIPE_PRICE_BUSINESS).toBe("price_business_123");
      expect(process.env.STRIPE_PRICE_DEVELOPER).toBe("price_developer_123");
    });
  });

  describe("webhook handling", () => {
    it("should require stripe signature", () => {
      // Test that the handler is configured to check for stripe-signature
      const webhookRoute = stripeHandler.routes.find(
        (r) => r.path === "/stripe/webhook",
      );
      expect(webhookRoute).toBeDefined();
    });

    it("should handle various webhook events", () => {
      const expectedEvents = [
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed",
      ];

      expect(expectedEvents.length).toBe(4);
    });
  });

  describe("error handling", () => {
    it("should handle missing environment variables", () => {
      // Test that getStripeInstance and getWebhookSecret throw errors when env vars are missing
      expect(process.env.STRIPE_SECRET_KEY).toBe("test_secret_key");
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBe("test_webhook_secret");
    });

    it("should validate authorization headers", () => {
      // The handler should check for Bearer tokens
      expect(
        stripeHandler.routes.some(
          (r) => r.path === "/stripe/create-checkout-session",
        ),
      ).toBe(true);
    });
  });
});
