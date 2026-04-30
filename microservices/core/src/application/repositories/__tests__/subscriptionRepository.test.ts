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
    "onConflictDoNothing",
    "onConflictDoUpdate",
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
  tier: "premium" as const,
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
    it("creates new subscription when no row exists for either lookup", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await repo.upsertByStripeCustomerId({
        userId: "user-uuid-1",
        stripeCustomerId: "cus_123",
        tier: "premium",
        status: "active",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
    });

    it("updates existing subscription matched by stripeCustomerId", async () => {
      await repo.upsertByStripeCustomerId({
        userId: "user-uuid-1",
        stripeCustomerId: "cus_123",
        tier: "free",
        status: "active",
      });

      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("upgrades a pre-existing free row matched by userId when no stripeCustomerId match", async () => {
      // First select (findByStripeCustomerId) → no match.
      // Second select (findByUserId) → existing free row, no Stripe IDs yet.
      // The repo must update that row in place rather than insert.
      const freeRow = {
        ...mockSubscriptionRow,
        tier: "free" as const,
        status: "active" as const,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
      const select = mockDb.select as ReturnType<typeof vi.fn>;
      select.mockReturnValueOnce(mockChain([])); // by stripeCustomerId
      select.mockReturnValueOnce(mockChain([freeRow])); // by userId

      await repo.upsertByStripeCustomerId({
        userId: "user-uuid-1",
        stripeCustomerId: "cus_new_456",
        stripeSubscriptionId: "sub_new_789",
        tier: "premium",
        status: "active",
      });

      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe("createFreeSubscription", () => {
    it("inserts a new free row when the user has no subscription", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const insertedRow = {
        ...mockSubscriptionRow,
        tier: "free" as const,
        status: "active" as const,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([insertedRow]),
      );

      const sub = await repo.createFreeSubscription("user-uuid-1");

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(sub.tier).toBe("free");
      expect(sub.status).toBe("active");
    });

    it("returns the existing row unchanged when a subscription already exists (idempotent)", async () => {
      // Default mockDb.select returns mockSubscriptionRow (premium/active).
      const sub = await repo.createFreeSubscription("user-uuid-1");

      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(sub.tier).toBe("premium");
      expect(sub.id).toBe(mockSubscriptionRow.id);
    });

    it("returns the winner's row when ON CONFLICT swallows the insert (race)", async () => {
      // Two concurrent calls: this one finds no row, attempts insert, but the
      // other call already inserted — onConflictDoNothing yields []. The repo
      // must re-read and return the winner's row instead of throwing.
      const winnerRow = {
        ...mockSubscriptionRow,
        tier: "free" as const,
        status: "active" as const,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      };
      const select = mockDb.select as ReturnType<typeof vi.fn>;
      select.mockReturnValueOnce(mockChain([])); // initial findByUserId — no row
      select.mockReturnValueOnce(mockChain([winnerRow])); // post-conflict re-read
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const sub = await repo.createFreeSubscription("user-uuid-1");

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(sub.id).toBe(winnerRow.id);
      expect(sub.tier).toBe("free");
    });

    it("throws when insert returns no row AND no row appears on re-read", async () => {
      // Defensive case: shouldn't happen in practice (the unique constraint
      // implies a row must exist if onConflictDoNothing fired), but if the DB
      // somehow returns nothing both times, surface that as an error rather
      // than a silent null.
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(repo.createFreeSubscription("user-uuid-1")).rejects.toThrow(
        /no row returned/,
      );
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
      await repo.updateTier("sub-uuid-1", "enterprise");
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

  describe("updateCancelAtPeriodEnd", () => {
    it("flips the flag to true for portal-scheduled cancellation", async () => {
      await repo.updateCancelAtPeriodEnd("sub-uuid-1", true);
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("flips the flag back to false when the user resumes via the portal", async () => {
      await repo.updateCancelAtPeriodEnd("sub-uuid-1", false);
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });
});
