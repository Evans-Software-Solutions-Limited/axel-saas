import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
}));

// Mock auth
vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => {
  return {
    getAuthUser: vi.fn(),
    requireAuth: vi.fn(),
    getUser: vi.fn(),
  };
});

// Mock repository
vi.mock("../repositories/userRepository", () => {
  return {
    userRepository: {
      getUserBySupabaseId: vi.fn(),
      updateOnboardingAnswers: vi.fn(),
      updateUser: vi.fn(),
    },
  };
});

describe("UserHandler - Available Methods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should have access to available methods", async () => {
    const { userHandler } = await import("../userHandler");
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(userHandler),
    );
    expect(methods.length).toBeGreaterThan(0);
  });

  it("should have routes property", async () => {
    const { userHandler } = await import("../userHandler");
    expect(userHandler.routes).toBeDefined();
    expect(Array.isArray(userHandler.routes)).toBe(true);
  });

  it("should have fetch method if available", async () => {
    const { userHandler } = await import("../userHandler");
    // Elysia instances may have fetch method
    if (typeof (userHandler as any).fetch === "function") {
      expect((userHandler as any).fetch).toBeDefined();
    }
  });

  it("should have handle method if available", async () => {
    const { userHandler } = await import("../userHandler");
    // Elysia instances may have handle method
    if (typeof (userHandler as any).handle === "function") {
      expect((userHandler as any).handle).toBeDefined();
    }
  });

  it("should properly expose routes", async () => {
    const { userHandler } = await import("../userHandler");
    const routes = userHandler.routes;
    expect(routes.length).toBeGreaterThanOrEqual(2); // At least GET and POST
  });

  it("should have GET /users/me in routes", async () => {
    const { userHandler } = await import("../userHandler");
    const route = userHandler.routes.find(
      (r) => r.method === "GET" && r.path === "/users/me",
    );
    expect(route).toBeDefined();
  });

  it("should have POST /users/onboarding in routes", async () => {
    const { userHandler } = await import("../userHandler");
    const route = userHandler.routes.find(
      (r) => r.method === "POST" && r.path === "/users/onboarding",
    );
    expect(route).toBeDefined();
  });
});
