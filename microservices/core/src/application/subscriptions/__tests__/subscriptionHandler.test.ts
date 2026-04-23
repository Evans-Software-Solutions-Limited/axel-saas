import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockAuthContext {
  user?: { sub: string };
  set: { status?: number };
}

// Mock auth before importing handlers
vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => {
  return {
    getAuthUser: vi.fn(async (authHeader: string | undefined) => {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
      }
      return {
        sub: "test-user-id",
        email: "test@example.com",
      };
    }),
    requireAuth: (ctx: MockAuthContext) => {
      if (!ctx.user) {
        ctx.set.status = 401;
        return { success: false, error: "Unauthorized" };
      }
    },
    getUser: (ctx: MockAuthContext) => ctx.user || { sub: "test-user-id" },
  };
});

// Mock Stripe
const mockSessionCreate = vi
  .fn()
  .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test_sub" });
const mockCustomerCreate = vi.fn().mockResolvedValue({ id: "cus_sub_test" });

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: mockSessionCreate } },
    customers: { create: mockCustomerCreate },
  })),
}));

vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

const { mockFindByUserId, mockFindBySupabaseId } = vi.hoisted(() => ({
  mockFindByUserId: vi.fn().mockResolvedValue(null),
  mockFindBySupabaseId: vi.fn().mockResolvedValue({
    id: "db-user-id",
    email: "test@example.com",
    fullName: "Test User",
    supabaseUserId: "test-user-id",
  }),
}));

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockFindByUserId,
  })),
}));

vi.mock("../../repositories/userRepository", () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findBySupabaseId: mockFindBySupabaseId,
  })),
  userRepository: {
    getUserBySupabaseId: vi.fn(),
  },
}));

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_sub_123");
vi.stubEnv("STRIPE_PRICE_PREMIUM", "price_premium_sub");
vi.stubEnv("VITE_WEB_URL", "http://localhost:5173");

import {
  subscriptionHandler,
  subscriptionPublicHandler,
  TIERS,
} from "../subscriptionHandler";

describe("SubscriptionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionCreate.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/cs_test_sub",
    });
    mockCustomerCreate.mockResolvedValue({ id: "cus_sub_test" });
    mockFindByUserId.mockResolvedValue(null);
    mockFindBySupabaseId.mockResolvedValue({
      id: "db-user-id",
      email: "test@example.com",
      fullName: "Test User",
      supabaseUserId: "test-user-id",
    });
  });

  describe("TIERS constant", () => {
    it("exposes exactly Free, Premium, Enterprise", () => {
      const ids = TIERS.map((t) => t.id);
      expect(ids).toEqual(["free", "premium", "enterprise"]);
    });

    it("prices Free at 0 and Premium at 49 GBP", () => {
      const free = TIERS.find((t) => t.id === "free");
      const premium = TIERS.find((t) => t.id === "premium");
      expect(free?.priceGbpMonthly).toBe(0);
      expect(premium?.priceGbpMonthly).toBe(49);
    });

    it("marks Enterprise as not self-serve", () => {
      const enterprise = TIERS.find((t) => t.id === "enterprise");
      expect(enterprise?.selfServe).toBe(false);
      expect(enterprise?.priceGbpMonthly).toBeNull();
    });
  });

  describe("GET /subscriptions/tiers (public)", () => {
    it("returns the three tiers without authentication", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", { method: "GET" }),
      );

      expect(result.status).toBe(200);
      const tiers = (await result.json()) as Array<{ id: string }>;
      expect(tiers.map((t) => t.id)).toEqual(["free", "premium", "enterprise"]);
    });

    it("each tier has a non-empty feature list", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", { method: "GET" }),
      );
      const tiers = (await result.json()) as Array<{ features: string[] }>;
      for (const tier of tiers) {
        expect(Array.isArray(tier.features)).toBe(true);
        expect(tier.features.length).toBeGreaterThan(0);
      }
    });
  });

  describe("POST /subscriptions/checkout (protected)", () => {
    it("returns 401 without authorization", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId: "premium" }),
        }),
      );

      expect(result.status).toBe(401);
    });

    it("creates a Stripe checkout session for 'premium'", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "premium" }),
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as { success: boolean; url: string };
      expect(json.success).toBe(true);
      expect(json.url).toBe("https://checkout.stripe.com/pay/cs_test_sub");
    });

    it.each([["free"], ["enterprise"], ["starter"], ["pro"], ["business"]])(
      "rejects non-checkout tier %s with 400",
      async (tier) => {
        const result = await subscriptionHandler.handle(
          new Request("http://localhost/subscriptions/checkout", {
            method: "POST",
            headers: {
              authorization: "Bearer test_token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tierId: tier }),
          }),
        );

        expect(result.status).toBe(400);
      },
    );

    it("returns 400 for an unknown tier", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "invalid_tier" }),
        }),
      );

      expect(result.status).toBe(400);
    });

    it("reuses an existing Stripe customer when a subscription row exists", async () => {
      mockFindByUserId.mockResolvedValue({
        id: "sub-id",
        stripeCustomerId: "cus_existing_456",
      });

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "premium" }),
        }),
      );

      expect(result.status).toBe(200);
      expect(mockCustomerCreate).not.toHaveBeenCalled();
      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing_456" }),
      );
    });

    it("returns 500 when STRIPE_PRICE_PREMIUM is missing", async () => {
      vi.stubEnv("STRIPE_PRICE_PREMIUM", "");

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "premium" }),
        }),
      );

      expect(result.status).toBe(500);
      vi.stubEnv("STRIPE_PRICE_PREMIUM", "price_premium_sub");
    });

    it("returns 404 when the user is missing", async () => {
      mockFindBySupabaseId.mockResolvedValue(null);

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "premium" }),
        }),
      );

      expect(result.status).toBe(404);
    });

    it("returns 500 when Stripe returns a null session URL", async () => {
      mockSessionCreate.mockResolvedValue({ url: null });

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "premium" }),
        }),
      );

      expect(result.status).toBe(500);
      const json = (await result.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/checkout URL/i);
    });
  });

  describe("GET /subscriptions/status (protected)", () => {
    it("returns 401 without authorization", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/status", { method: "GET" }),
      );
      expect(result.status).toBe(401);
    });

    it("returns null subscription when the user has none", async () => {
      mockFindByUserId.mockResolvedValue(null);

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/status", {
          method: "GET",
          headers: { authorization: "Bearer test_token" },
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as {
        success: boolean;
        subscription: null;
      };
      expect(json.success).toBe(true);
      expect(json.subscription).toBeNull();
    });

    it("returns subscription data (tier, status, period end) when one exists", async () => {
      mockFindByUserId.mockResolvedValue({
        id: "sub-123",
        userId: "db-user-id",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
        tier: "premium",
        status: "active",
        currentPeriodEnd: new Date("2026-04-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/status", {
          method: "GET",
          headers: { authorization: "Bearer test_token" },
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as {
        success: boolean;
        subscription: { tier: string; status: string };
      };
      expect(json.success).toBe(true);
      expect(json.subscription?.tier).toBe("premium");
      expect(json.subscription?.status).toBe("active");
    });

    it("returns 404 when the user is not found", async () => {
      mockFindBySupabaseId.mockResolvedValue(null);

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/status", {
          method: "GET",
          headers: { authorization: "Bearer test_token" },
        }),
      );

      expect(result.status).toBe(404);
    });
  });

  describe("route definitions", () => {
    it("public handler exposes GET /subscriptions/tiers", () => {
      const route = subscriptionPublicHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/subscriptions/tiers",
      );
      expect(route).toBeDefined();
    });

    it("protected handler exposes POST /subscriptions/checkout and GET /subscriptions/status", () => {
      const checkout = subscriptionHandler.routes.find(
        (r) => r.method === "POST" && r.path === "/subscriptions/checkout",
      );
      const status = subscriptionHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/subscriptions/status",
      );
      expect(checkout).toBeDefined();
      expect(status).toBeDefined();
    });
  });
});
