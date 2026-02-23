import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserRepository } from "../userRepository";
import type { Db } from "@axel-saas/db";

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
      update: vi.fn(() => mockChain([])),
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
});
