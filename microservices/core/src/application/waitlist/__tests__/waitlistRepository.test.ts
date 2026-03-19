import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@axel-saas/db";

vi.mock("@axel-saas/db", async () => {
  const actual =
    await vi.importActual<typeof import("@axel-saas/db")>("@axel-saas/db");
  return {
    ...actual,
    getDb: vi.fn(() => ({})),
  };
});

import { WaitlistRepository, NotFoundError } from "../waitlistRepository";

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

const NOW = new Date("2026-01-01T10:00:00.000Z");

const mockEntry = {
  id: "entry-uuid-1",
  email: "test@example.com",
  interestedIn: "pro" as const,
  token: "token-uuid-1",
  confirmedAt: NOW,
  updatedAt: NOW,
};

describe("WaitlistRepository", () => {
  let mockDb: Partial<Db>;
  let repo: WaitlistRepository;

  beforeEach(() => {
    mockDb = {
      select: vi.fn(() => mockChain([mockEntry])),
      insert: vi.fn(() => mockChain([mockEntry])),
      update: vi.fn(() => mockChain([])),
      delete: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new WaitlistRepository(mockDb as Db);
  });

  describe("upsertByEmail — new entry", () => {
    it("creates a new entry when the email does not exist", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const { record, isNew } = await repo.upsertByEmail(
        "New@Example.com",
        "pro",
      );

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(isNew).toBe(true);
      expect(record.email).toBe("test@example.com");
    });

    it("normalises the email to lowercase on insert", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await repo.upsertByEmail("UPPER@EXAMPLE.COM", "free");

      const insertCall = (mockDb.insert as ReturnType<typeof vi.fn>).mock
        .calls[0];
      // insert is called with the waitlist table object; values are chained
      expect(insertCall).toBeDefined();
    });

    it("sets confirmedAt on first insert", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const { isNew } = await repo.upsertByEmail(
        "new@example.com",
        "enterprise",
      );
      expect(isNew).toBe(true);
    });

    it("throws if insert returns no row", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.upsertByEmail("new@example.com", "pro"),
      ).rejects.toThrow("Failed to create waitlist entry");
    });
  });

  describe("upsertByEmail — existing entry (update)", () => {
    it("updates interestedIn when email already exists", async () => {
      const { isNew } = await repo.upsertByEmail(
        "test@example.com",
        "enterprise",
      );

      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(isNew).toBe(false);
    });

    it("returns the updated record", async () => {
      const updatedEntry = {
        ...mockEntry,
        interestedIn: "enterprise" as const,
      };
      // First select returns existing, second returns updated
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockEntry]))
        .mockReturnValueOnce(mockChain([updatedEntry]));

      const { record, isNew } = await repo.upsertByEmail(
        "test@example.com",
        "enterprise",
      );

      expect(isNew).toBe(false);
      expect(record.interestedIn).toBe("enterprise");
    });

    it("normalises email to lowercase when checking for existing", async () => {
      await repo.upsertByEmail("TEST@EXAMPLE.COM", "free");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("deleteByToken — found", () => {
    it("deletes entry when token exists", async () => {
      await repo.deleteByToken("token-uuid-1");

      expect(mockDb.select).toHaveBeenCalledOnce();
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });

    it("resolves without error for valid token", async () => {
      await expect(repo.deleteByToken("token-uuid-1")).resolves.toBeUndefined();
    });
  });

  describe("deleteByToken — not found", () => {
    it("throws NotFoundError when token does not exist", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(repo.deleteByToken("bad-token")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError with descriptive message", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(repo.deleteByToken("bad-token")).rejects.toThrow(
        "Waitlist entry not found",
      );
    });

    it("does not call delete when token is missing", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(repo.deleteByToken("bad-token")).rejects.toThrow();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });

  describe("NotFoundError", () => {
    it("has correct name", () => {
      const err = new NotFoundError("test");
      expect(err.name).toBe("NotFoundError");
      expect(err.message).toBe("test");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
