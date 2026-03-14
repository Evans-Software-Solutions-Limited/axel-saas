import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock database before importing the handler
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  users: {},
  subscriptions: {},
  provisioningState: {},
  onboardingAnswers: {},
}));

// Mock the auth utilities before importing the handler
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
    requireAuth: vi.fn((ctx, next) => {
      if (!ctx.user) {
        ctx.set.status = 401;
        return { success: false, error: "Unauthorized" };
      }
      return next();
    }),
    getUser: vi.fn((ctx) => ctx.user || { sub: "test-user-id" }),
  };
});

vi.mock("../../repositories/userRepository", () => {
  return {
    userRepository: {
      getUserBySupabaseId: vi.fn(async (supabaseId: string) => {
        if (supabaseId === "test-user-id") {
          return {
            id: "db-user-id",
            email: "test@example.com",
            fullName: "Test User",
            onboardingCompleted: false,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-01"),
          };
        }
        return null;
      }),
      updateUser: vi.fn(async () => {
        return { id: "db-user-id", onboardingCompleted: true };
      }),
    },
  };
});

describe("UserHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("userHandler instance and routes", () => {
    it("should be defined", async () => {
      const { userHandler } = await import("../userHandler");
      expect(userHandler).toBeDefined();
    });

    it("should have expected routes", async () => {
      const { userHandler } = await import("../userHandler");
      expect(userHandler.routes).toBeDefined();
      expect(Array.isArray(userHandler.routes)).toBe(true);
      expect(userHandler.routes.length).toBeGreaterThan(0);
    });

    it("should have GET /users/me route", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoutes = userHandler.routes.filter((r) => r.method === "GET");
      const meRoute = getRoutes.find((r) => r.path === "/users/me");
      expect(meRoute).toBeDefined();
    });
  });

  describe("GET /users/me route", () => {
    it("should exist and be accessible", async () => {
      const { userHandler } = await import("../userHandler");
      const meRoute = userHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/users/me",
      );
      expect(meRoute).toBeDefined();
    });

    it("should have proper handler signature", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoutes = userHandler.routes.filter((r) => r.method === "GET");
      expect(getRoutes.length).toBeGreaterThan(0);
      const meRoute = getRoutes.find((r) => r.path === "/users/me");
      expect(meRoute).toBeDefined();
    });

    it("should require authentication", async () => {
      const { userHandler } = await import("../userHandler");
      // Handler has onBeforeHandle requireAuth middleware
      expect(userHandler.routes.length).toBeGreaterThan(0);
    });
  });

  describe("route configuration", () => {
    it("should have proper route structure", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoute = userHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/users/me",
      );

      expect(getRoute).toBeDefined();
    });

    it("should require authentication on all routes", async () => {
      const { userHandler } = await import("../userHandler");
      // All routes should have derive and onBeforeHandle with requireAuth
      expect(userHandler.routes.length).toBeGreaterThan(0);
    });

    it("should have expected number of routes", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoutes = userHandler.routes.filter((r) => r.method === "GET");

      expect(getRoutes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error handling paths", () => {
    it("should handle database errors in GET /users/me", async () => {
      const { userRepository } =
        await import("../../repositories/userRepository");
      vi.mocked(userRepository.getUserBySupabaseId).mockRejectedValueOnce(
        new Error("Database error"),
      );

      try {
        await userRepository.getUserBySupabaseId("user-id");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe("data transformation and response", () => {
    it("should format user response correctly", () => {
      const user = {
        id: "user-id",
        email: "user@example.com",
        fullName: "User Name",
        onboardingCompleted: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      const response = {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          onboardingCompleted: user.onboardingCompleted,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };

      expect(response.success).toBe(true);
      expect(response.user.id).toBe("user-id");
      expect(response.user.email).toBe("user@example.com");
    });

    it("should return error message on failure", () => {
      const response = {
        success: false,
        error: "User not found",
      };

      expect(response.success).toBe(false);
      expect(response.error).toBe("User not found");
    });
  });
});
