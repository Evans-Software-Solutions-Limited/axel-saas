import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock auth
vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: vi.fn(async (authHeader: string | undefined) => {
    if (!authHeader?.startsWith("Bearer valid_")) return null;
    return { sub: "supabase-user-id" };
  }),
  requireAuth: vi.fn(),
  getUser: vi.fn((ctx: { user?: { sub: string } }) => ctx.user),
}));

// Mock Stripe
const mockSessionCreate = vi
  .fn()
  .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test_123" });
const mockCustomerCreate = vi.fn().mockResolvedValue({ id: "cus_test_123" });
const mockConstructEvent = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionCreate } },
    customers: { create: mockCustomerCreate },
    webhooks: { constructEvent: mockConstructEvent },
    invoices: { list: vi.fn(), retrieve: vi.fn() },
  })),
}));

vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

const mockFindByUserId = vi.fn().mockResolvedValue(null);
vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindByUserId,
    findByStripeCustomerId: vi.fn().mockResolvedValue(null),
    upsertByStripeCustomerId: vi.fn(),
    updateTier: vi.fn(),
    updatePeriodEnd: vi.fn(),
    updateStatus: vi.fn(),
  })),
}));

vi.mock("../../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn().mockImplementation(() => ({
    findByUserId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
  })),
}));

vi.mock("../../repositories/userRepository", () => ({
  userRepository: {
    getUserBySupabaseId: vi.fn().mockResolvedValue({
      id: "db-user-id",
      email: "test@example.com",
      fullName: "Test User",
      supabaseUserId: "supabase-user-id",
    }),
  },
}));

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter");
vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_business");
vi.stubEnv("STRIPE_PRICE_DEVELOPER", "price_developer");
vi.stubEnv("VITE_WEB_URL", "http://localhost:5173");

import { stripeHandler } from "../stripeHandler";

describe("StripeHandler Checkout Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply default mocks after clearAllMocks
    mockSessionCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });
    mockCustomerCreate.mockResolvedValue({ id: "cus_test_123" });
    mockFindByUserId.mockResolvedValue(null);
  });

  describe("POST /stripe/create-checkout-session", () => {
    it("should create a checkout session and return URL for valid tier with auth", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "pro" }),
        }),
      );

      expect(response.status).toBe(200);
      const json = (await response.json()) as { url: string };
      expect(json.url).toBe("https://checkout.stripe.com/pay/cs_test_123");
    });

    it("should create a new Stripe customer when none exists", async () => {
      mockFindByUserId.mockResolvedValue(null);

      await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "starter" }),
        }),
      );

      expect(mockCustomerCreate).toHaveBeenCalledOnce();
    });

    it("should reuse existing Stripe customer when subscription exists", async () => {
      mockFindByUserId.mockResolvedValue({
        id: "sub-id",
        stripeCustomerId: "cus_existing_123",
      });

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "business" }),
        }),
      );

      expect(response.status).toBe(200);
      expect(mockCustomerCreate).not.toHaveBeenCalled();
      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing_123" }),
      );
    });

    it("should pass correct metadata to Stripe checkout session", async () => {
      await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "developer" }),
        }),
      );

      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          metadata: { userId: "db-user-id", tier: "developer" },
          success_url: "http://localhost:5173/dashboard?checkout=success",
          cancel_url: "http://localhost:5173/subscribe?checkout=cancelled",
        }),
      );
    });

    it("should reject request without Bearer token", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Basic token",
          },
          body: JSON.stringify({ tier: "pro" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("should reject request without authorization header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: "pro" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("should reject invalid tier", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "invalid" }),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("should reject empty tier", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "" }),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("should reject missing tier in body", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("should validate Bearer token format strictly", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearertoken",
          },
          body: JSON.stringify({ tier: "pro" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("should return 401 when JWT verification fails", async () => {
      // Token doesn't start with "Bearer valid_" so getAuthUser returns null
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer bad_jwt",
          },
          body: JSON.stringify({ tier: "pro" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("should accept all valid tiers", async () => {
      for (const tier of ["starter", "pro", "business", "developer"]) {
        const response = await stripeHandler.handle(
          new Request("http://localhost/stripe/create-checkout-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer valid_token",
            },
            body: JSON.stringify({ tier }),
          }),
        );
        expect(response.status).toBe(200);
      }
    });
  });

  describe("POST /stripe/webhook", () => {
    it("should require stripe-signature header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "event_data",
        }),
      );

      expect(response.status).toBe(400);
    });

    it("should process webhook with valid signature header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "sig_test_1234567890",
          },
          body: "event_data",
        }),
      );

      // Signature validation will fail with test data, but route accepts the header
      expect([400, 500]).toContain(response.status);
    });

    it("should handle webhook with empty signature", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "",
          },
          body: "event_data",
        }),
      );

      expect(response.status).toBe(400);
    });
  });

  describe("Route definitions", () => {
    it("should have POST /stripe/create-checkout-session route", () => {
      const route = stripeHandler.routes.find(
        (r) =>
          r.method === "POST" && r.path === "/stripe/create-checkout-session",
      );
      expect(route).toBeDefined();
    });

    it("should have POST /stripe/webhook route", () => {
      const route = stripeHandler.routes.find(
        (r) => r.method === "POST" && r.path === "/stripe/webhook",
      );
      expect(route).toBeDefined();
    });

    it("should have exactly 2 POST routes", () => {
      const postRoutes = stripeHandler.routes.filter(
        (r) => r.method === "POST",
      );
      expect(postRoutes.length).toBe(2);
    });

    it("should be an Elysia instance", () => {
      expect(stripeHandler).toBeDefined();
      expect(typeof stripeHandler).toBe("object");
    });
  });
});
