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
vi.mock("../../repositories/userRepository", () => {
  return {
    UserRepository: vi.fn().mockImplementation(() => ({
      deleteById: vi.fn(),
    })),
    userRepository: {
      getUserBySupabaseId: vi.fn(),
      updateUser: vi.fn(),
      updateProfile: vi.fn(),
      updateNotificationPreferences: vi.fn(),
      deleteById: vi.fn(),
    },
    withNotificationDefaults: (
      prefs: Record<string, boolean> | null | undefined,
    ) => ({
      emailNotifications: true,
      weeklyDigest: true,
      ...(prefs ?? {}),
    }),
    NOTIFICATION_DEFAULTS: { emailNotifications: true, weeklyDigest: true },
  };
});

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    findByUserId: vi.fn(),
  })),
}));

vi.mock("../accountDeletionService", () => ({
  AccountDeletionService: vi.fn().mockImplementation(() => ({
    deleteAccount: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

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
    type ElysiaLike = { fetch?: unknown; handle?: unknown; routes: unknown[] };
    const handler = userHandler as ElysiaLike;
    if (typeof handler.fetch === "function") {
      expect(handler.fetch).toBeDefined();
    }
  });

  it("should have handle method if available", async () => {
    const { userHandler } = await import("../userHandler");
    type ElysiaLike = { fetch?: unknown; handle?: unknown; routes: unknown[] };
    const handler = userHandler as ElysiaLike;
    if (typeof handler.handle === "function") {
      expect(handler.handle).toBeDefined();
    }
  });

  it("should properly expose routes", async () => {
    const { userHandler } = await import("../userHandler");
    const routes = userHandler.routes;
    expect(routes.length).toBeGreaterThanOrEqual(1);
  });

  it("should have GET /users/me in routes", async () => {
    const { userHandler } = await import("../userHandler");
    const route = userHandler.routes.find(
      (r) => r.method === "GET" && r.path === "/users/me",
    );
    expect(route).toBeDefined();
  });
});
