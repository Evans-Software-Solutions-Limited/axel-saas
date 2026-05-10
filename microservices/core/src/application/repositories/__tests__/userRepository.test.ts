import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@axel-saas/db";

// Mock the db module BEFORE importing UserRepository to prevent module-level instantiation
vi.mock("@axel-saas/db", async () => {
  const actual =
    await vi.importActual<typeof import("@axel-saas/db")>("@axel-saas/db");
  return {
    ...actual,
    getDb: vi.fn(() => ({})),
  };
});

import {
  NOTIFICATION_DEFAULTS,
  UserRepository,
  withNotificationDefaults,
} from "../userRepository";

/**
 * Creates a fluent chain that:
 * - Returns itself from all query builder methods
 * - Is directly awaitable
 * - Returns a real Promise from `.returning()`
 */
function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  const fluent = [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "offset",
    "orderBy",
    "leftJoin",
    "innerJoin",
  ];

  for (const method of fluent) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (reject: Parameters<Promise<T>["catch"]>[0]) =>
    promise.catch(reject);

  return chain;
}

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockUserRow = {
  id: "user-uuid-1",
  supabaseUserId: "supabase-123",
  email: "user@example.com",
  fullName: "Test User",
  onboardingCompleted: false,
  notificationPreferences: {},
  createdAt: NOW,
  updatedAt: NOW,
};

describe("UserRepository", () => {
  let mockDb: Partial<Db>;
  let repo: UserRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockUserRow])),
      select: vi.fn(() => mockChain([mockUserRow])),
      update: vi.fn(() => mockChain([mockUserRow])),
      delete: vi.fn(() => mockChain([{ id: "user-uuid-1" }])),
    } as unknown as Partial<Db>;
    repo = new UserRepository(mockDb as Db);
  });

  describe("create", () => {
    it("creates a new user", async () => {
      const user = await repo.create({
        supabaseUserId: "supabase-123",
        email: "user@example.com",
        fullName: "Test User",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(user.id).toBe("user-uuid-1");
      expect(user.email).toBe("user@example.com");
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          supabaseUserId: "sup-123",
          email: "test@test.com",
        }),
      ).rejects.toThrow("Failed to create user");
    });
  });

  describe("findBySupabaseId", () => {
    it("returns user with relations when found", async () => {
      const user = await repo.findBySupabaseId("supabase-123");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-uuid-1");
      expect(user?.supabaseUserId).toBe("supabase-123");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const user = await repo.findBySupabaseId("nonexistent");
      expect(user).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns user when found", async () => {
      const user = await repo.findById("user-uuid-1");
      expect(user?.id).toBe("user-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const user = await repo.findById("nonexistent");
      expect(user).toBeNull();
    });
  });

  describe("updateById", () => {
    it("updates user by id", async () => {
      await repo.updateById("user-uuid-1", { fullName: "Updated Name" });
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("getUserBySupabaseId", () => {
    it("returns user when found", async () => {
      const user = await repo.getUserBySupabaseId("supabase-123");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-uuid-1");
      expect(user?.email).toBe("user@example.com");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const user = await repo.getUserBySupabaseId("nonexistent");
      expect(user).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("updates user with new values", async () => {
      await repo.updateUser("user-uuid-1", {
        fullName: "New Name",
        onboardingCompleted: true,
      });
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("does not update id or createdAt", async () => {
      await repo.updateUser("user-uuid-1", {
        email: "newemail@example.com",
      });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("updateProfile", () => {
    it("returns the updated row on success", async () => {
      const next = await repo.updateProfile("user-uuid-1", {
        fullName: "Ada Lovelace",
      });
      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(next?.id).toBe("user-uuid-1");
    });

    it("returns null when no row matches", async () => {
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const next = await repo.updateProfile("missing", {
        fullName: "Ada Lovelace",
      });
      expect(next).toBeNull();
    });
  });

  describe("updateNotificationPreferences", () => {
    it("returns the updated preferences on success", async () => {
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        mockChain([
          {
            ...mockUserRow,
            notificationPreferences: {
              emailNotifications: false,
              weeklyDigest: true,
            },
          },
        ]),
      );

      const stored = await repo.updateNotificationPreferences("user-uuid-1", {
        emailNotifications: false,
        weeklyDigest: true,
      });

      expect(stored).toEqual({
        emailNotifications: false,
        weeklyDigest: true,
      });
    });

    it("returns null when no row matches", async () => {
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const stored = await repo.updateNotificationPreferences("missing", {
        emailNotifications: false,
      });
      expect(stored).toBeNull();
    });
  });

  describe("deleteById", () => {
    it("returns true when a row is deleted", async () => {
      const ok = await repo.deleteById("user-uuid-1");
      expect(mockDb.delete).toHaveBeenCalledOnce();
      expect(ok).toBe(true);
    });

    it("returns false when no row matches", async () => {
      (mockDb.delete as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const ok = await repo.deleteById("missing");
      expect(ok).toBe(false);
    });
  });

  describe("withNotificationDefaults", () => {
    it("fills in defaults for missing keys", () => {
      expect(withNotificationDefaults({})).toEqual(NOTIFICATION_DEFAULTS);
    });

    it("respects explicit values when set", () => {
      const merged = withNotificationDefaults({
        emailNotifications: false,
      });
      expect(merged.emailNotifications).toBe(false);
      expect(merged.weeklyDigest).toBe(true);
    });

    it.each([null, undefined])("treats %s like an empty object", (input) => {
      expect(withNotificationDefaults(input as null | undefined)).toEqual(
        NOTIFICATION_DEFAULTS,
      );
    });
  });

  describe("updateOnboardingAnswers", () => {
    it("inserts new onboarding answers if not exists", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ userId: "user-uuid-1", answers: {} }]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", {
        name: "John",
        channels: ["slack"],
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("updates existing onboarding answers", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ userId: "user-uuid-1" }]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", {
        name: "John",
        channels: ["email"],
      });

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("sets completedAt date for new answers", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", { test: true });
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });
});
