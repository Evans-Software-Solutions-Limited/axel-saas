import { describe, it, expect, vi, beforeEach } from "vitest";
import { OauthStateRepository } from "../oauthStateRepository";
import type { Db } from "@axel-saas/db";

function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  const fluent = ["values", "from", "where", "limit"];

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

const NOW = new Date("2026-05-02T12:00:00.000Z");
const TEN_MIN = new Date("2026-05-02T12:10:00.000Z");

const mockRow = {
  id: "state-uuid-1",
  userId: "user-uuid-1",
  integrationId: "google",
  stateToken: "csrf-token-abc",
  returnPath: "/integrations",
  expiresAt: TEN_MIN,
  createdAt: NOW,
};

describe("OauthStateRepository", () => {
  let mockDb: Partial<Db>;
  let repo: OauthStateRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockRow])),
      select: vi.fn(() => mockChain([mockRow])),
      delete: vi.fn(() => mockChain(undefined)),
    } as unknown as Partial<Db>;
    repo = new OauthStateRepository(mockDb as Db);
  });

  describe("create", () => {
    it("inserts and returns the new row", async () => {
      const result = await repo.create({
        userId: "user-uuid-1",
        integrationId: "google",
        stateToken: "csrf-token-abc",
        returnPath: "/integrations",
        expiresAt: TEN_MIN,
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(result.stateToken).toBe("csrf-token-abc");
    });

    it("throws when insert returns no row", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          userId: "user-uuid-1",
          integrationId: "google",
          stateToken: "csrf-token-abc",
          returnPath: null,
          expiresAt: TEN_MIN,
        }),
      ).rejects.toThrow("Failed to create oauth state — no row returned");
    });

    it("accepts a null returnPath", async () => {
      const rowWithNullPath = { ...mockRow, returnPath: null };
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([rowWithNullPath]),
      );

      const result = await repo.create({
        userId: "user-uuid-1",
        integrationId: "google",
        stateToken: "csrf-token-abc",
        returnPath: null,
        expiresAt: TEN_MIN,
      });

      expect(result.returnPath).toBeNull();
    });
  });

  describe("findByToken", () => {
    it("returns the row when found", async () => {
      const result = await repo.findByToken("csrf-token-abc");
      expect(result?.stateToken).toBe("csrf-token-abc");
    });

    it("returns null when no row matches", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const result = await repo.findByToken("does-not-exist");
      expect(result).toBeNull();
    });
  });

  describe("deleteByToken", () => {
    it("calls delete with the token filter", async () => {
      await repo.deleteByToken("csrf-token-abc");
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });
  });
});
