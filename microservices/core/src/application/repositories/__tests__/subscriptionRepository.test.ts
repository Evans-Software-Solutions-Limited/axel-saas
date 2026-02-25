import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionRepository } from "../subscriptionRepository";
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

const mockSubscriptionRow = {
  id: "sub-uuid-1",
  userId: "user-uuid-1",
  stripeCustomerId: "cus_123",
  stripeSubscriptionId: "sub_stripe_123",
  tier: "pro" as const,
  status: "active" as const,
  currentPeriodEnd: new Date("2025-06-01"),
  createdAt: NOW,
  updatedAt: NOW,
};

describe("SubscriptionRepository", () => {
  let mockDb: Partial<Db>;
  let repo: SubscriptionRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockSubscriptionRow])),
      select: vi.fn(() => mockChain([mockSubscriptionRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new SubscriptionRepository(mockDb as Db);
  });

  describe("findByUserId", () => {
    it("returns subscription when found", async () => {
      const sub = await repo.findByUserId("user-uuid-1");
      expect(sub).not.toBeNull();
      expect(sub?.userId).toBe("user-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const sub = await repo.findByUserId("nonexistent");
      expect(sub).toBeNull();
    });
  });

  describe("findByStripeCustomerId", () => {
    it("returns subscription when found", async () => {
      const sub = await repo.findByStripeCustomerId("cus_123");
      expect(sub).not.toBeNull();
      expect(sub?.stripeCustomerId).toBe("cus_123");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const sub = await repo.findByStripeCustomerId("nonexistent");
      expect(sub).toBeNull();
    });
  });

  describe("upsertByStripeCustomerId", () => {
    it("creates new subscription when not exists", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await repo.upsertByStripeCustomerId({
        userId: "user-uuid-1",
        stripeCustomerId: "cus_123",
        tier: "pro",
        status: "active",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
    });

    it("updates existing subscription", async () => {
      await repo.upsertByStripeCustomerId({
        userId: "user-uuid-1",
        stripeCustomerId: "cus_123",
        tier: "business",
        status: "active",
      });

      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateStatus", () => {
    it("updates subscription status", async () => {
      await repo.updateStatus("sub-uuid-1", "past_due");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateTier", () => {
    it("updates subscription tier", async () => {
      await repo.updateTier("sub-uuid-1", "business");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updatePeriodEnd", () => {
    it("updates current period end", async () => {
      const newDate = new Date("2025-07-01");
      await repo.updatePeriodEnd("sub-uuid-1", newDate);
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });
});
