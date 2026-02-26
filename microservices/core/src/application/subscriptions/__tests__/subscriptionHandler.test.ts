import { describe, it, expect, vi, beforeEach } from "vitest";

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
    requireAuth: (ctx: any) => {
      if (!ctx.user) {
        ctx.set.status = 401;
        return { success: false, error: "Unauthorized" };
      }
    },
    getUser: (ctx: any) => ctx.user || { sub: "test-user-id" },
  };
});

import {
  subscriptionHandler,
  subscriptionPublicHandler,
} from "../subscriptionHandler";

describe("SubscriptionHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "starter" }),
        }),
      );

      expect(result.status).toBe(401);
    });

    it("should accept checkout request with valid tier", async () => {
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
      const json = (await result.json()) as {
        success: boolean;
        tierId: string;
        userId: string;
      };
      expect(json.success).toBe(true);
      expect(json.tierId).toBe("starter");
      expect(json.userId).toBe("test-user-id");
    });

    it("should accept pro tier", async () => {
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

      const json = (await result.json()) as { tierId: string };
      expect(json.tierId).toBe("pro");
    });

    it("should accept business tier", async () => {
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

      const json = (await result.json()) as { tierId: string };
      expect(json.tierId).toBe("business");
    });

    it("should accept developer tier", async () => {
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

      const json = (await result.json()) as { tierId: string };
      expect(json.tierId).toBe("developer");
    });

    it("should include user sub in response", async () => {
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

      const json = (await result.json()) as { userId: string };
      expect(json.userId).toBeDefined();
      expect(typeof json.userId).toBe("string");
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
  });
});
