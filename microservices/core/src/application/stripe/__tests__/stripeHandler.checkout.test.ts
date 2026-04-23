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
vi.stubEnv("STRIPE_PRICE_PREMIUM", "price_premium_test");
vi.stubEnv("VITE_WEB_URL", "http://localhost:5173");

import { stripeHandler } from "../stripeHandler";

describe("StripeHandler Checkout Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_123",
    });
    mockCustomerCreate.mockResolvedValue({ id: "cus_test_123" });
    mockFindByUserId.mockResolvedValue(null);
  });

  describe("POST /stripe/create-checkout-session", () => {
    it("creates a checkout session and returns URL for tier 'premium' with auth", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(200);
      const json = (await response.json()) as { url: string };
      expect(json.url).toBe("https://checkout.stripe.com/pay/cs_test_123");
    });

    it("creates a new Stripe customer when none exists", async () => {
      mockFindByUserId.mockResolvedValue(null);

      await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(mockCustomerCreate).toHaveBeenCalledOnce();
    });

    it("reuses existing Stripe customer when subscription exists", async () => {
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
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(200);
      expect(mockCustomerCreate).not.toHaveBeenCalled();
      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing_123" }),
      );
    });

    it("passes correct metadata to Stripe checkout session", async () => {
      await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "subscription",
          metadata: { userId: "db-user-id", tier: "premium" },
          success_url: "http://localhost:5173/dashboard?checkout=success",
          cancel_url: "http://localhost:5173/subscribe?checkout=cancelled",
        }),
      );
    });

    it("rejects request without Bearer token", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Basic token",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("rejects request without authorization header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it.each([["starter"], ["pro"], ["business"], ["developer"]])(
      "rejects legacy tier %s with 400",
      async (tier) => {
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

        expect(response.status).toBe(400);
      },
    );

    it("rejects invalid tier", async () => {
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

    it("rejects free tier — it is not self-serve via Stripe", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "free" }),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("rejects enterprise tier — it requires manual sales contact", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "enterprise" }),
        }),
      );

      expect(response.status).toBe(400);
    });

    it("rejects empty tier", async () => {
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

    it("validates Bearer token format strictly", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearertoken",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("returns 401 when JWT verification fails", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer bad_jwt",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("returns 500 when Stripe returns a null session URL", async () => {
      mockSessionCreate.mockResolvedValueOnce({ url: null });

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(500);
      const json = (await response.json()) as { error: string };
      expect(json.error).toBe("Checkout session URL unavailable");
    });

    it("returns 500 when STRIPE_PRICE_PREMIUM env var is missing", async () => {
      vi.stubEnv("STRIPE_PRICE_PREMIUM", "");

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer valid_token",
          },
          body: JSON.stringify({ tier: "premium" }),
        }),
      );

      expect(response.status).toBe(500);
      const json = (await response.json()) as { error: string };
      expect(json.error).toBe("Price not configured for tier");

      vi.stubEnv("STRIPE_PRICE_PREMIUM", "price_premium_test");
    });
  });

  describe("POST /stripe/webhook", () => {
    it("requires the stripe-signature header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "event_data",
        }),
      );

      expect(response.status).toBe(400);
    });

    it("rejects webhook with empty signature", async () => {
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

    it("rejects webhook when signature verification throws", async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error("signature mismatch");
      });

      // Body must be valid JSON for Elysia's parser; constructEvent is mocked
      // so the raw payload is never actually inspected.
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/webhook", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "stripe-signature": "sig_test_1234567890",
          },
          body: "{}",
        }),
      );

      expect(response.status).toBe(400);
      const json = (await response.json()) as { received: boolean };
      expect(json.received).toBe(false);
    });
  });

  describe("Route definitions", () => {
    it("exposes POST /stripe/create-checkout-session", () => {
      const route = stripeHandler.routes.find(
        (r) =>
          r.method === "POST" && r.path === "/stripe/create-checkout-session",
      );
      expect(route).toBeDefined();
    });

    it("exposes POST /stripe/webhook", () => {
      const route = stripeHandler.routes.find(
        (r) => r.method === "POST" && r.path === "/stripe/webhook",
      );
      expect(route).toBeDefined();
    });

    it("exposes GET /stripe/invoices", () => {
      const route = stripeHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/stripe/invoices",
      );
      expect(route).toBeDefined();
    });

    it("exposes GET /stripe/invoices/:id", () => {
      const route = stripeHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/stripe/invoices/:id",
      );
      expect(route).toBeDefined();
    });
  });
});
