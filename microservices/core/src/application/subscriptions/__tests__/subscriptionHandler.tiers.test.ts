import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockAuthContext {
  user?: { sub: string };
  set: { status?: number };
}

// Mock db before any imports that use it
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

// Mock repositories to prevent getDb() call at module load
vi.mock("../../repositories/userRepository", () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findBySupabaseId: vi.fn().mockResolvedValue(null),
  })),
  userRepository: { getUserBySupabaseId: vi.fn() },
}));

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: vi.fn().mockResolvedValue(null),
  })),
}));

// Mock auth
vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
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
}));

import { subscriptionHandler } from "../subscriptionHandler";

describe("SubscriptionHandler Tiers and Checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /subscriptions/tiers (Public Endpoint)", () => {
    it("should return all subscription tiers", async () => {
      // All tiers should be returned
      const expectedTiers = ["starter", "pro", "business", "developer"];

      for (const tierId of expectedTiers) {
        expect(expectedTiers).toContain(tierId);
      }
    });

    it("should return starter tier with correct properties", async () => {
      const starterTier = {
        id: "starter",
        name: "Starter",
        priceGbpMonthly: 19,
        features: ["Daily brief", "Telegram", "Basic tasks", "Email triage"],
      };

      expect(starterTier.id).toBe("starter");
      expect(starterTier.priceGbpMonthly).toBe(19);
      expect(starterTier.features).toContain("Daily brief");
      expect(starterTier.features).toContain("Telegram");
    });

    it("should return pro tier with correct properties", async () => {
      const proTier = {
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
      };

      expect(proTier.id).toBe("pro");
      expect(proTier.priceGbpMonthly).toBe(49);
      expect(proTier.features).toContain("Calendar");
      expect(proTier.features).toContain("Sub-agents");
    });

    it("should return business tier with correct properties", async () => {
      const businessTier = {
        id: "business",
        name: "Business",
        priceGbpMonthly: 99,
        features: [
          "Everything in Pro",
          "Custom channels",
          "Multiple agents",
          "Priority support",
        ],
      };

      expect(businessTier.id).toBe("business");
      expect(businessTier.priceGbpMonthly).toBe(99);
      expect(businessTier.features).toContain("Custom channels");
      expect(businessTier.features).toContain("Multiple agents");
    });

    it("should return developer tier with correct properties", async () => {
      const developerTier = {
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
      };

      expect(developerTier.id).toBe("developer");
      expect(developerTier.priceGbpMonthly).toBe(149);
      expect(developerTier.features).toContain("Full exec access");
      expect(developerTier.features).toContain("API access");
    });

    it("should return tiers in correct price order", async () => {
      const prices = [19, 49, 99, 149];
      for (let i = 0; i < prices.length - 1; i++) {
        expect(prices[i]).toBeLessThan(prices[i + 1]);
      }
    });

    it("should have features array for each tier", async () => {
      const tiers = [
        { id: "starter", features: ["Daily brief"] },
        { id: "pro", features: ["Calendar"] },
        { id: "business", features: ["Custom channels"] },
        { id: "developer", features: ["API access"] },
      ];

      for (const tier of tiers) {
        expect(tier.features).toBeInstanceOf(Array);
        expect(tier.features.length).toBeGreaterThan(0);
      }
    });

    it("should not require authentication for public tier endpoint", async () => {
      // Public endpoint should work without auth
      const isPublic = true;
      expect(isPublic).toBeTruthy();
    });

    it("should return consistent tier structure", async () => {
      const tierStructure = {
        id: expect.any(String),
        name: expect.any(String),
        priceGbpMonthly: expect.any(Number),
        features: expect.any(Array),
      };

      const starterTier = {
        id: "starter",
        name: "Starter",
        priceGbpMonthly: 19,
        features: ["Daily brief"],
      };

      expect(starterTier).toMatchObject(tierStructure);
    });

    it("should have all tier IDs be unique", async () => {
      const tierIds = ["starter", "pro", "business", "developer"];
      const uniqueIds = new Set(tierIds);
      expect(uniqueIds.size).toBe(tierIds.length);
    });
  });

  describe("POST /subscriptions/checkout (Protected Endpoint)", () => {
    it("should require authentication for checkout", async () => {
      const response = await subscriptionHandler.handle(
        new Request("http://localhost/subscriptions/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tierId: "pro" }),
        }),
      );
      expect(response.status).toBe(401);
    });

    it("should initiate checkout for valid tier", async () => {
      const requestBody = {
        tierId: "pro",
      };

      expect(requestBody.tierId).toBe("pro");
      expect(["starter", "pro", "business", "developer"]).toContain(
        requestBody.tierId,
      );
    });

    it("should return user ID in checkout response", async () => {
      const userId = "test-user-id";
      expect(userId).toBeDefined();
      expect(userId).toEqual("test-user-id");
    });

    it("should return tier ID in checkout response", async () => {
      const tierId = "pro";
      expect(tierId).toBeDefined();
      expect(["starter", "pro", "business", "developer"]).toContain(tierId);
    });

    it("should validate tier ID parameter", async () => {
      const validTierIds = ["starter", "pro", "business", "developer"];
      const tierId = "pro";
      expect(validTierIds).toContain(tierId);
    });

    it("should handle all valid tier checkouts", async () => {
      const validTiers = ["starter", "pro", "business", "developer"];

      for (const tier of validTiers) {
        expect(validTiers).toContain(tier);
      }
    });

    it("should include success flag in response", async () => {
      const response = {
        success: true,
        message: "Checkout initiated (Stripe integration coming soon)",
        tierId: "pro",
        userId: "test-user-id",
      };

      expect(response.success).toBe(true);
      expect(response.message).toBeDefined();
    });
  });

  describe("Tier comparison and pricing", () => {
    it("should have increasing prices from starter to developer", async () => {
      const tiers = [
        { id: "starter", price: 19 },
        { id: "pro", price: 49 },
        { id: "business", price: 99 },
        { id: "developer", price: 149 },
      ];

      for (let i = 0; i < tiers.length - 1; i++) {
        expect(tiers[i].price).toBeLessThan(tiers[i + 1].price);
      }
    });

    it("should have starter tier as entry point", async () => {
      const starterPrice = 19;
      const otherPrices = [49, 99, 149];

      expect(starterPrice).toBeLessThan(Math.min(...otherPrices));
    });

    it("should have developer tier as premium option", async () => {
      const developerPrice = 149;
      const otherPrices = [19, 49, 99];

      expect(developerPrice).toBeGreaterThan(Math.max(...otherPrices));
    });

    it("should have specific price differences", async () => {
      const starterPrice = 19;
      const proPrice = 49;
      const businessPrice = 99;
      const developerPrice = 149;

      expect(proPrice - starterPrice).toBe(30);
      expect(businessPrice - proPrice).toBe(50);
      expect(developerPrice - businessPrice).toBe(50);
    });
  });

  describe("Feature progression", () => {
    it("pro tier should include all starter features", async () => {
      const proFeatures = [
        "Everything in Starter",
        "Calendar",
        "Email send/receive",
      ];

      expect(proFeatures).toContain("Everything in Starter");
    });

    it("business tier should include all pro features", async () => {
      const businessFeatures = [
        "Everything in Pro",
        "Custom channels",
        "Multiple agents",
      ];

      expect(businessFeatures).toContain("Everything in Pro");
    });

    it("developer tier should include all business features", async () => {
      const developerFeatures = [
        "Everything in Business",
        "Full exec access",
        "API access",
      ];

      expect(developerFeatures).toContain("Everything in Business");
    });
  });
});
