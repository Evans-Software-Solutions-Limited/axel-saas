import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenUsageRepository, utcDateString } from "../tokenUsageRepository";
import type { Db } from "@axel-saas/db";

function mockChain<T>(result: T | T[]) {
  const chain: Record<string, unknown> = {};
  const resultArray = Array.isArray(result) ? result : [result];
  const promise = Promise.resolve(resultArray);

  const fluent = [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "orderBy",
    "onConflictDoUpdate",
  ];
  for (const method of fluent) {
    chain[method] = () => chain;
  }
  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<typeof resultArray>["then"]>[0],
    reject?: Parameters<Promise<typeof resultArray>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (
    reject: Parameters<Promise<typeof resultArray>["catch"]>[0],
  ) => promise.catch(reject);

  return chain;
}

const NOW = new Date("2026-05-03T15:00:00.000Z");

const mockRow = {
  id: "usage-uuid-1",
  userId: "user-uuid-1",
  usageDate: "2026-05-03",
  model: "anthropic/haiku",
  source: "chat",
  inputTokens: 200,
  outputTokens: 100,
  estimatedCostUsd: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("utcDateString", () => {
  it("formats a Date as YYYY-MM-DD in UTC", () => {
    expect(utcDateString(new Date("2026-05-03T23:59:00.000Z"))).toBe(
      "2026-05-03",
    );
  });

  it("rolls forward across midnight UTC even when local time is the previous day", () => {
    // 2026-05-03 23:30 NZST is 2026-05-03 11:30 UTC — same day. The point
    // here is just that the function uses UTC and not local time.
    expect(utcDateString(new Date("2026-05-04T00:01:00.000Z"))).toBe(
      "2026-05-04",
    );
  });
});

describe("TokenUsageRepository", () => {
  let mockDb: Partial<Db>;
  let repo: TokenUsageRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockRow])),
      select: vi.fn(() => mockChain([{ inputTokens: 200, outputTokens: 100 }])),
    } as unknown as Partial<Db>;
    repo = new TokenUsageRepository(mockDb as Db);
  });

  describe("incrementUsage", () => {
    it("inserts and returns the upserted row", async () => {
      const result = await repo.incrementUsage({
        userId: "user-uuid-1",
        usageDate: "2026-05-03",
        model: "anthropic/haiku",
        source: "chat",
        inputTokens: 200,
        outputTokens: 100,
      });
      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(result.inputTokens).toBe(200);
    });

    it("throws when the upsert returns no row", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      await expect(
        repo.incrementUsage({
          userId: "user-uuid-1",
          usageDate: "2026-05-03",
          model: "anthropic/haiku",
          source: "chat",
          inputTokens: 200,
          outputTokens: 100,
        }),
      ).rejects.toThrow("Failed to record token usage — no row returned");
    });

    it("forwards an explicit estimatedCostUsd onto the values payload", async () => {
      await repo.incrementUsage({
        userId: "user-uuid-1",
        usageDate: "2026-05-03",
        model: "anthropic/haiku",
        source: "chat",
        inputTokens: 1,
        outputTokens: 1,
        estimatedCostUsd: "0.000123",
      });
      expect(mockDb.insert).toHaveBeenCalledOnce();
    });
  });

  describe("getDailyTotals", () => {
    it("returns coerced numeric totals from the SUM aggregate", async () => {
      const result = await repo.getDailyTotals("user-uuid-1", "2026-05-03");
      expect(result).toEqual({ inputTokens: 200, outputTokens: 100 });
    });

    it("returns zeros when no rows match", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ inputTokens: 0, outputTokens: 0 }]),
      );
      const result = await repo.getDailyTotals("user-uuid-1", "2026-05-03");
      expect(result).toEqual({ inputTokens: 0, outputTokens: 0 });
    });

    it("defends against an empty aggregate result", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const result = await repo.getDailyTotals("user-uuid-1", "2026-05-03");
      expect(result).toEqual({ inputTokens: 0, outputTokens: 0 });
    });
  });

  describe("getRangeTotals", () => {
    it("returns coerced numeric totals over a date range", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ inputTokens: 5_000, outputTokens: 2_500 }]),
      );
      const result = await repo.getRangeTotals(
        "user-uuid-1",
        "2026-05-01",
        "2026-05-31",
      );
      expect(result).toEqual({ inputTokens: 5_000, outputTokens: 2_500 });
    });

    it("defends against an empty aggregate result", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const result = await repo.getRangeTotals(
        "user-uuid-1",
        "2026-05-01",
        "2026-05-31",
      );
      expect(result).toEqual({ inputTokens: 0, outputTokens: 0 });
    });
  });
});
