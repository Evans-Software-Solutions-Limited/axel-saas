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
vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter_sub");
vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_sub");
vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_business_sub");
vi.stubEnv("STRIPE_PRICE_DEVELOPER", "price_developer_sub");
vi.stubEnv("VITE_WEB_URL", "http://localhost:5173");

import {
  subscriptionHandler,
  subscriptionPublicHandler,
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

  describe("subscriptionPublicHandler instance", () => {
    it("should be defined", () => {
      expect(subscriptionPublicHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(subscriptionPublicHandler.routes).toBeDefined();
      expect(Array.isArray(subscriptionPublicHandler.routes)).toBe(true);
      expect(subscriptionPublicHandler.routes.length).toBeGreaterThan(0);
    });

    it("should have GET /subscriptions/tiers route", () => {
      const getRoutes = subscriptionPublicHandler.routes.filter(
        (r) => r.method === "GET",
      );
      const tiersRoute = getRoutes.find(
        (r) => r.path === "/subscriptions/tiers",
      );
      expect(tiersRoute).toBeDefined();
    });
  });

  describe("subscriptionHandler instance", () => {
    it("should be defined", () => {
      expect(subscriptionHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(subscriptionHandler.routes).toBeDefined();
      expect(Array.isArray(subscriptionHandler.routes)).toBe(true);
      expect(subscriptionHandler.routes.length).toBeGreaterThan(0);
    });

    it("should have POST /subscriptions/checkout route", () => {
      const postRoutes = subscriptionHandler.routes.filter(
        (r) => r.method === "POST",
      );
      const checkoutRoute = postRoutes.find(
        (r) => r.path === "/subscriptions/checkout",
      );
      expect(checkoutRoute).toBeDefined();
    });
  });

  describe("GET /subscriptions/tiers (public)", () => {
    it("should return all tiers without authentication", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      expect(result.status).toBe(200);
      const tiers = (await result.json()) as Array<{
        id: string;
        name: string;
        priceGbpMonthly: number;
        features: string[];
      }>;
      expect(Array.isArray(tiers)).toBe(true);
      expect(tiers.length).toBeGreaterThan(0);
    });

    it("should return tiers with correct structure", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      const tiers = (await result.json()) as Array<{
        id: string;
        name: string;
        priceGbpMonthly: number;
        features: string[];
      }>;
      for (const tier of tiers) {
        expect(tier.id).toBeDefined();
        expect(tier.name).toBeDefined();
        expect(tier.priceGbpMonthly).toBeDefined();
        expect(tier.features).toBeDefined();
        expect(Array.isArray(tier.features)).toBe(true);
      }
    });

    it("should include all four tier options", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      const tiers = (await result.json()) as Array<{ id: string }>;
      const tierIds = tiers.map((t) => t.id);
      expect(tierIds).toContain("starter");
      expect(tierIds).toContain("pro");
      expect(tierIds).toContain("business");
      expect(tierIds).toContain("developer");
    });

    it("should have starter tier with correct price", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      const tiers = (await result.json()) as Array<{
        id: string;
        priceGbpMonthly: number;
        features: string[];
      }>;
      const starter = tiers.find((t) => t.id === "starter");
      expect(starter).toBeDefined();
      expect(starter?.priceGbpMonthly).toBe(19);
      expect(starter?.features).toContain("Daily brief");
    });

    it("should have pro tier with correct price", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      const tiers = (await result.json()) as Array<{
        id: string;
        priceGbpMonthly: number;
        features: string[];
      }>;
      const pro = tiers.find((t) => t.id === "pro");
      expect(pro).toBeDefined();
      expect(pro?.priceGbpMonthly).toBe(49);
      expect(pro?.features).toContain("Calendar");
    });

    it("should have business tier with correct price", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      const tiers = (await result.json()) as Array<{
        id: string;
        priceGbpMonthly: number;
        features: string[];
      }>;
      const business = tiers.find((t) => t.id === "business");
      expect(business).toBeDefined();
      expect(business?.priceGbpMonthly).toBe(99);
      expect(business?.features).toContain("Priority support");
    });

    it("should have developer tier with correct price", async () => {
      const result = await subscriptionPublicHandler.handle(
        new Request("http://localhost/subscriptions/tiers", {
          method: "GET",
        }),
      );

      const tiers = (await result.json()) as Array<{
        id: string;
        priceGbpMonthly: number;
        features: string[];
      }>;
      const developer = tiers.find((t) => t.id === "developer");
      expect(developer).toBeDefined();
      expect(developer?.priceGbpMonthly).toBe(149);
      expect(developer?.features).toContain("API access");
    });
  });

  describe("POST /subscriptions/checkout (protected)", () => {
    it("should return 401 without authorization", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tierId: "starter" }),
        }),
      );

      expect(result.status).toBe(401);
    });

    it("should create a Stripe checkout session and return URL for starter tier", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "starter" }),
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as { success: boolean; url: string };
      expect(json.success).toBe(true);
      expect(json.url).toBe("https://checkout.stripe.com/pay/cs_test_sub");
    });

    it("should create a Stripe checkout session and return URL for pro tier", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "pro" }),
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as { success: boolean; url: string };
      expect(json.success).toBe(true);
      expect(typeof json.url).toBe("string");
    });

    it("should create a Stripe checkout session and return URL for business tier", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "business" }),
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as { success: boolean; url: string };
      expect(json.success).toBe(true);
      expect(typeof json.url).toBe("string");
    });

    it("should create a Stripe checkout session and return URL for developer tier", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "developer" }),
        }),
      );

      expect(result.status).toBe(200);
      const json = (await result.json()) as { success: boolean; url: string };
      expect(json.success).toBe(true);
      expect(typeof json.url).toBe("string");
    });

    it("should return 400 for an invalid tier", async () => {
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

    it("should reuse existing Stripe customer when subscription exists", async () => {
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
          body: JSON.stringify({ tierId: "starter" }),
        }),
      );

      expect(result.status).toBe(200);
      expect(mockCustomerCreate).not.toHaveBeenCalled();
      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ customer: "cus_existing_456" }),
      );
    });
  });

  describe("subscription tiers structure", () => {
    it("should define expected tier structure", () => {
      expect(
        subscriptionPublicHandler.routes.some(
          (r) => r.path === "/subscriptions/tiers",
        ),
      ).toBe(true);
    });

    it("should have proper route configuration", () => {
      const publicGetRoute = subscriptionPublicHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/subscriptions/tiers",
      );
      const protectedPostRoute = subscriptionHandler.routes.find(
        (r) => r.method === "POST" && r.path === "/subscriptions/checkout",
      );

      expect(publicGetRoute).toBeDefined();
      expect(protectedPostRoute).toBeDefined();
    });

    it("should separate public and protected handlers", () => {
      expect(subscriptionPublicHandler).toBeDefined();
      expect(subscriptionHandler).toBeDefined();
      expect(subscriptionPublicHandler).not.toEqual(subscriptionHandler);
    });

    it("should have GET /subscriptions/status route", () => {
      const statusRoute = subscriptionHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/subscriptions/status",
      );
      expect(statusRoute).toBeDefined();
    });
  });

  describe("GET /subscriptions/status (protected)", () => {
    it("should return 401 without authorization", async () => {
      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/status", {
          method: "GET",
        }),
      );
      expect(result.status).toBe(401);
    });

    it("should return null subscription when user has no subscription", async () => {
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

    it("should return subscription data when subscription exists", async () => {
      const mockSub = {
        id: "sub-123",
        userId: "db-user-id",
        stripeCustomerId: "cus_test",
        stripeSubscriptionId: "sub_test",
        tier: "pro" as const,
        status: "active" as const,
        currentPeriodEnd: new Date("2026-04-01"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockFindByUserId.mockResolvedValue(mockSub);

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
      expect(json.subscription?.tier).toBe("pro");
      expect(json.subscription?.status).toBe("active");
    });

    it("should return 404 when user not found", async () => {
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

  describe("POST /subscriptions/checkout error branches", () => {
    it("should return 500 when price is not configured for tier", async () => {
      // Simulate missing price env var
      vi.stubEnv("STRIPE_PRICE_PRO", "");

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "pro" }),
        }),
      );

      expect(result.status).toBe(500);
      vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_sub");
    });

    it("should return 404 when user not found in checkout", async () => {
      mockFindBySupabaseId.mockResolvedValue(null);

      const result = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            authorization: "Bearer test_token",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "pro" }),
        }),
      );

      expect(result.status).toBe(404);
    });
  });
});
