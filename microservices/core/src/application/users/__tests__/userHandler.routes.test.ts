import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockAuthContext {
  user?: { sub: string };
  set: { status?: number };
}

vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: vi.fn(async (authHeader: string | undefined) => {
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return { sub: "test-user-id", email: "test@example.com" };
  }),
  requireAuth: (ctx: MockAuthContext) => {
    if (!ctx.user) {
      ctx.set.status = 401;
      return { success: false, error: "Unauthorized" };
    }
  },
  getUser: (ctx: MockAuthContext) => ctx.user || { sub: "test-user-id" },
}));

vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
}));

const userRepoMock = vi.hoisted(() => ({
  getUserBySupabaseId: vi.fn(),
  updateProfile: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  deleteById: vi.fn(),
}));

const subscriptionRepoMock = vi.hoisted(() => ({
  findByUserId: vi.fn(),
}));

const accountDeletionMock = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
}));

vi.mock("../../repositories/userRepository", async () => {
  const actual = await vi.importActual<
    typeof import("../../repositories/userRepository")
  >("../../repositories/userRepository");
  return {
    ...actual,
    UserRepository: vi.fn().mockImplementation(() => userRepoMock),
    userRepository: userRepoMock,
  };
});

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi
    .fn()
    .mockImplementation(() => subscriptionRepoMock),
}));

vi.mock("../accountDeletionService", () => ({
  AccountDeletionService: vi.fn().mockImplementation(() => accountDeletionMock),
}));

import { userHandler } from "../userHandler";

const BASE = "http://localhost";
const AUTHED_HEADERS = {
  authorization: "Bearer test_token",
  "Content-Type": "application/json",
};

const BASE_USER = {
  id: "db-user-id",
  supabaseUserId: "test-user-id",
  email: "test@example.com",
  fullName: "Existing Name",
  onboardingCompleted: true,
  notificationPreferences: {},
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-15"),
};

describe("userHandler routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userRepoMock.getUserBySupabaseId.mockResolvedValue(BASE_USER);
    userRepoMock.updateProfile.mockImplementation(async (_id, updates) => ({
      ...BASE_USER,
      fullName: updates.fullName,
    }));
    userRepoMock.updateNotificationPreferences.mockImplementation(
      async (_id, prefs) => prefs,
    );
    userRepoMock.deleteById.mockResolvedValue(true);
    accountDeletionMock.deleteAccount.mockResolvedValue({ success: true });
  });

  describe("GET /users/me", () => {
    it("returns 401 without authorization", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, { method: "GET" }),
      );
      expect(result.status).toBe(401);
    });

    it("returns the user profile with notification defaults filled in", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "GET",
          headers: AUTHED_HEADERS,
        }),
      );

      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        success: boolean;
        user: { notificationPreferences: Record<string, boolean> };
      };
      expect(body.success).toBe(true);
      expect(body.user.notificationPreferences).toEqual({
        emailNotifications: true,
        weeklyDigest: true,
      });
    });

    it("returns 404 when the user row is missing", async () => {
      userRepoMock.getUserBySupabaseId.mockResolvedValueOnce(null);
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "GET",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(404);
    });

    it("returns 500 when the repo throws", async () => {
      userRepoMock.getUserBySupabaseId.mockRejectedValueOnce(
        new Error("db boom"),
      );
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "GET",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(500);
    });
  });

  describe("PUT /users/me", () => {
    it("returns 401 without authorization", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Ada Lovelace" }),
        }),
      );
      expect(result.status).toBe(401);
    });

    it("trims whitespace and persists the new name", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ name: "  Ada Lovelace  " }),
        }),
      );

      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        success: boolean;
        user: { fullName: string };
      };
      expect(body.success).toBe(true);
      expect(body.user.fullName).toBe("Ada Lovelace");
      expect(userRepoMock.updateProfile).toHaveBeenCalledWith("db-user-id", {
        fullName: "Ada Lovelace",
      });
    });

    it("rejects whitespace-only names with 400 (slips past minLength: 1)", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ name: "   " }),
        }),
      );
      expect(result.status).toBe(400);
      expect(userRepoMock.updateProfile).not.toHaveBeenCalled();
    });

    it("rejects empty body via Elysia validation", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({}),
        }),
      );
      expect([400, 422]).toContain(result.status);
    });

    it("returns 404 when the user row is missing", async () => {
      userRepoMock.getUserBySupabaseId.mockResolvedValueOnce(null);
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ name: "Ada" }),
        }),
      );
      expect(result.status).toBe(404);
    });

    it("returns 404 when the update path returns null (raced delete)", async () => {
      userRepoMock.updateProfile.mockResolvedValueOnce(null);
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ name: "Ada" }),
        }),
      );
      expect(result.status).toBe(404);
    });

    it("returns 500 when the repo throws", async () => {
      userRepoMock.updateProfile.mockRejectedValueOnce(new Error("db down"));
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ name: "Ada" }),
        }),
      );
      expect(result.status).toBe(500);
    });
  });

  describe("PUT /users/me/notifications", () => {
    it("returns 401 without authorization", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me/notifications`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailNotifications: false }),
        }),
      );
      expect(result.status).toBe(401);
    });

    it("merges the partial body with the existing prefs and defaults", async () => {
      userRepoMock.getUserBySupabaseId.mockResolvedValueOnce({
        ...BASE_USER,
        notificationPreferences: { weeklyDigest: false },
      });

      const result = await userHandler.handle(
        new Request(`${BASE}/users/me/notifications`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ emailNotifications: false }),
        }),
      );

      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        success: boolean;
        notificationPreferences: Record<string, boolean>;
      };
      expect(body.notificationPreferences).toEqual({
        emailNotifications: false,
        weeklyDigest: false,
      });
      // Repo receives the fully-merged object so a partial write never
      // silently drops a key.
      expect(userRepoMock.updateNotificationPreferences).toHaveBeenCalledWith(
        "db-user-id",
        { emailNotifications: false, weeklyDigest: false },
      );
    });

    it("returns 404 when the user row is missing", async () => {
      userRepoMock.getUserBySupabaseId.mockResolvedValueOnce(null);
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me/notifications`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ emailNotifications: false }),
        }),
      );
      expect(result.status).toBe(404);
    });

    it("returns 404 when the update path returns null", async () => {
      userRepoMock.updateNotificationPreferences.mockResolvedValueOnce(null);
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me/notifications`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ emailNotifications: false }),
        }),
      );
      expect(result.status).toBe(404);
    });

    it("returns 500 when the repo throws", async () => {
      userRepoMock.updateNotificationPreferences.mockRejectedValueOnce(
        new Error("db down"),
      );
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me/notifications`, {
          method: "PUT",
          headers: AUTHED_HEADERS,
          body: JSON.stringify({ emailNotifications: false }),
        }),
      );
      expect(result.status).toBe(500);
    });
  });

  describe("DELETE /users/me", () => {
    it("returns 401 without authorization", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, { method: "DELETE" }),
      );
      expect(result.status).toBe(401);
    });

    it("returns 200 on a successful deletion", async () => {
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "DELETE",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(200);
      const body = (await result.json()) as { success: boolean };
      expect(body.success).toBe(true);
      expect(accountDeletionMock.deleteAccount).toHaveBeenCalledWith({
        dbUserId: "db-user-id",
        supabaseUserId: "test-user-id",
      });
    });

    it("returns 404 when the user row is missing", async () => {
      userRepoMock.getUserBySupabaseId.mockResolvedValueOnce(null);
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "DELETE",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(404);
    });

    it("maps Stripe failures to a 502", async () => {
      accountDeletionMock.deleteAccount.mockResolvedValueOnce({
        success: false,
        reason: "stripe_cancel_failed",
      });
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "DELETE",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(502);
    });

    it("maps DB / auth failures to a 500", async () => {
      accountDeletionMock.deleteAccount.mockResolvedValueOnce({
        success: false,
        reason: "db_delete_failed",
      });
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "DELETE",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(500);
    });

    it("returns 500 when the service throws unexpectedly", async () => {
      accountDeletionMock.deleteAccount.mockRejectedValueOnce(
        new Error("orchestration boom"),
      );
      const result = await userHandler.handle(
        new Request(`${BASE}/users/me`, {
          method: "DELETE",
          headers: AUTHED_HEADERS,
        }),
      );
      expect(result.status).toBe(500);
    });
  });
});
