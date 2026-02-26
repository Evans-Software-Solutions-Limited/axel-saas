import { describe, it, expect, vi } from "vitest";

// Mock the database and repositories before importing the handler
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
}));

vi.mock("../repositories/userRepository", () => ({
  userRepository: {
    getUserBySupabaseId: vi.fn(),
    updateOnboardingAnswers: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: vi.fn(),
  requireAuth: vi.fn((ctx, next) => next()),
  getUser: vi.fn(),
}));

describe("UserHandler", () => {
  describe("userHandler instance", () => {
    it("should be defined", async () => {
      const { userHandler } = await import("../userHandler");
      expect(userHandler).toBeDefined();
    });

    it("should have expected routes", async () => {
      const { userHandler } = await import("../userHandler");
      expect(userHandler.routes).toBeDefined();
      expect(Array.isArray(userHandler.routes)).toBe(true);
    });

    it("should have GET /users/me route", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoutes = userHandler.routes.filter((r) => r.method === "GET");
      const meRoute = getRoutes.find((r) => r.path === "/users/me");
      expect(meRoute).toBeDefined();
    });

    it("should have POST /users/onboarding route", async () => {
      const { userHandler } = await import("../userHandler");
      const postRoutes = userHandler.routes.filter((r) => r.method === "POST");
      const onboardingRoute = postRoutes.find(
        (r) => r.path === "/users/onboarding",
      );
      expect(onboardingRoute).toBeDefined();
    });
  });

  describe("route configuration", () => {
    it("should have proper route structure", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoute = userHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/users/me",
      );
      const postRoute = userHandler.routes.find(
        (r) => r.method === "POST" && r.path === "/users/onboarding",
      );

      expect(getRoute).toBeDefined();
      expect(postRoute).toBeDefined();
    });

    it("should have expected number of routes", async () => {
      const { userHandler } = await import("../userHandler");
      const getRoutes = userHandler.routes.filter((r) => r.method === "GET");
      const postRoutes = userHandler.routes.filter((r) => r.method === "POST");

      expect(getRoutes.length).toBeGreaterThan(0);
      expect(postRoutes.length).toBeGreaterThan(0);
    });
  });
});
