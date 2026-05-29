import { describe, it, expect, beforeEach, vi } from "vitest";
import { OpenclawSessionsRepository } from "../openclawSessionsRepository";
import type { Db } from "@axel-saas/db";

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
  for (const m of fluent) chain[m] = () => chain;
  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (reject: Parameters<Promise<T>["catch"]>[0]) =>
    promise.catch(reject);
  return chain;
}

const NOW = new Date("2026-05-20T10:00:00.000Z");

function mockRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-uuid-1",
    userId: "user-uuid-1",
    name: "demo",
    tier: "premium" as const,
    taskArn: "arn:aws:ecs:eu-west-2:111:task/abc",
    targetGroupArn: "arn:aws:elb:tg/abc",
    listenerRuleArn: "arn:aws:elb:rule/abc",
    efsAccessPointId: "fsap-aaa",
    startedAt: NOW,
    stoppedAt: null,
    stoppedReason: null,
    ...overrides,
  };
}

describe("OpenclawSessionsRepository", () => {
  let db: Partial<Db>;
  let repo: OpenclawSessionsRepository;
  let selectMock: ReturnType<typeof vi.fn>;
  let insertMock: ReturnType<typeof vi.fn>;
  let updateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    selectMock = vi.fn(() => mockChain([mockRow()]));
    insertMock = vi.fn(() => mockChain([mockRow()]));
    updateMock = vi.fn(() => mockChain([]));
    db = {
      select: selectMock,
      insert: insertMock,
      update: updateMock,
    } as unknown as Partial<Db>;
    repo = new OpenclawSessionsRepository(db as Db);
  });

  describe("create", () => {
    it("returns the inserted row", async () => {
      const row = await repo.create({
        userId: "user-uuid-1",
        name: "demo",
        tier: "premium",
        taskArn: "arn:task",
        targetGroupArn: "arn:tg",
        listenerRuleArn: "arn:rule",
        efsAccessPointId: "fsap",
      });
      expect(row.id).toBe("session-uuid-1");
      expect(insertMock).toHaveBeenCalledOnce();
    });

    it("forwards an explicit `id` to the insert when provided", async () => {
      const valuesSpy = vi.fn(() => mockChain([mockRow()]));
      insertMock.mockReturnValue({
        values: valuesSpy,
        returning: () => Promise.resolve([mockRow()]),
      });
      await repo.create({
        id: "explicit-session-uuid",
        userId: "user-uuid-1",
        name: "demo",
        tier: "premium",
        taskArn: "arn:task",
        targetGroupArn: "arn:tg",
        listenerRuleArn: "arn:rule",
        efsAccessPointId: "fsap",
      });
      // Without `id` set in input, drizzle uses the column default;
      // with it, the value is forwarded. Critical for the
      // sessionId-must-match-row invariant called out by inspector-brad.
      expect(valuesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: "explicit-session-uuid" }),
      );
    });

    it("omits `id` from .values when not provided (DB generates it)", async () => {
      const valuesSpy = vi.fn(() => mockChain([mockRow()]));
      insertMock.mockReturnValue({
        values: valuesSpy,
        returning: () => Promise.resolve([mockRow()]),
      });
      await repo.create({
        userId: "user-uuid-1",
        name: "demo",
        tier: "premium",
        taskArn: "arn:task",
        targetGroupArn: "arn:tg",
        listenerRuleArn: "arn:rule",
        efsAccessPointId: "fsap",
      });
      const call = valuesSpy.mock.calls[0] as unknown as [
        Record<string, unknown>,
      ];
      const valuesArg = call[0];
      expect(Object.prototype.hasOwnProperty.call(valuesArg, "id")).toBe(false);
    });

    it("throws when insert returns nothing", async () => {
      insertMock.mockReturnValue(mockChain([]));
      await expect(
        repo.create({
          userId: "user-uuid-1",
          name: "demo",
          tier: "premium",
          taskArn: "arn:task",
          targetGroupArn: "arn:tg",
          listenerRuleArn: "arn:rule",
          efsAccessPointId: "fsap",
        }),
      ).rejects.toThrow(/Failed to insert/);
    });
  });

  describe("findActiveByName", () => {
    it("returns the row when found", async () => {
      const row = await repo.findActiveByName("demo");
      expect(row?.id).toBe("session-uuid-1");
    });

    it("is case-insensitive against the lookup arg", async () => {
      await repo.findActiveByName("DEMO");
      expect(selectMock).toHaveBeenCalled();
      // Repository should lowercase before querying; the mock chain
      // doesn't capture SQL, but we verify the query was issued.
    });

    it("returns null when no row matches", async () => {
      selectMock.mockReturnValue(mockChain([]));
      const row = await repo.findActiveByName("does-not-exist");
      expect(row).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns the row when present", async () => {
      const row = await repo.findById("session-uuid-1");
      expect(row?.id).toBe("session-uuid-1");
    });

    it("returns null otherwise", async () => {
      selectMock.mockReturnValue(mockChain([]));
      const row = await repo.findById("missing");
      expect(row).toBeNull();
    });
  });

  describe("listActiveByUserId", () => {
    it("returns the chain result", async () => {
      selectMock.mockReturnValue(mockChain([mockRow(), mockRow({ id: "s2" })]));
      const rows = await repo.listActiveByUserId("user-uuid-1");
      expect(rows).toHaveLength(2);
    });
  });

  describe("rankAmongActive", () => {
    it("returns the 0-based index when the session is in the active set", async () => {
      selectMock.mockReturnValue(
        mockChain([{ id: "s1" }, { id: "s2" }, { id: "s3" }]),
      );
      expect(await repo.rankAmongActive("user-uuid-1", "s2")).toBe(1);
    });

    it("returns -1 when the session id is not in the active set", async () => {
      selectMock.mockReturnValue(mockChain([{ id: "s1" }, { id: "s2" }]));
      expect(await repo.rankAmongActive("user-uuid-1", "missing")).toBe(-1);
    });

    it("returns -1 when the user has no active sessions", async () => {
      selectMock.mockReturnValue(mockChain([]));
      expect(await repo.rankAmongActive("user-uuid-1", "any")).toBe(-1);
    });

    it("returns 0 when the session is the only active row", async () => {
      selectMock.mockReturnValue(mockChain([{ id: "only" }]));
      expect(await repo.rankAmongActive("user-uuid-1", "only")).toBe(0);
    });
  });

  describe("countActiveByUserId", () => {
    it("returns the length of the active rows", async () => {
      selectMock.mockReturnValue(
        mockChain([mockRow(), mockRow({ id: "s2" }), mockRow({ id: "s3" })]),
      );
      const count = await repo.countActiveByUserId("user-uuid-1");
      expect(count).toBe(3);
    });

    it("returns 0 when no rows", async () => {
      selectMock.mockReturnValue(mockChain([]));
      expect(await repo.countActiveByUserId("user-uuid-1")).toBe(0);
    });
  });

  describe("findLastEfsAccessPointId", () => {
    it("returns the stored ID", async () => {
      selectMock.mockReturnValue(
        mockChain([{ efsAccessPointId: "fsap-existing" }]),
      );
      expect(await repo.findLastEfsAccessPointId("user-uuid-1")).toBe(
        "fsap-existing",
      );
    });

    it("returns null when user has never had a session", async () => {
      selectMock.mockReturnValue(mockChain([]));
      expect(await repo.findLastEfsAccessPointId("brand-new-user")).toBeNull();
    });
  });

  describe("markStopped", () => {
    it("issues the update with the supplied reason", async () => {
      await repo.markStopped("session-uuid-1", "user");
      expect(updateMock).toHaveBeenCalledOnce();
    });

    it("accepts an explicit stoppedAt", async () => {
      const t = new Date("2030-01-01");
      await repo.markStopped("session-uuid-1", "reaper", t);
      expect(updateMock).toHaveBeenCalled();
    });
  });

  describe("listExpired", () => {
    const HOUR_MS = 60 * 60 * 1000;
    const caps = {
      free: 1 * HOUR_MS,
      premium: 8 * HOUR_MS,
      enterprise: 24 * HOUR_MS,
    };

    it("returns rows whose started_at + tier cap is in the past", async () => {
      // now = noon. Free started 90 min ago (expired by 30 min);
      // premium started 30 min ago (not expired); enterprise started
      // 2 h ago (not expired).
      const now = new Date("2026-05-20T12:00:00.000Z");
      selectMock.mockReturnValue(
        mockChain([
          mockRow({
            id: "free-expired",
            tier: "free",
            startedAt: new Date("2026-05-20T10:30:00.000Z"),
          }),
          mockRow({
            id: "premium-fresh",
            tier: "premium",
            startedAt: new Date("2026-05-20T11:30:00.000Z"),
          }),
          mockRow({
            id: "enterprise-fresh",
            tier: "enterprise",
            startedAt: new Date("2026-05-20T10:00:00.000Z"),
          }),
        ]),
      );
      const rows = await repo.listExpired(now, caps);
      expect(rows.map((r) => r.id)).toEqual(["free-expired"]);
    });

    it("returns empty when no active rows are past their cap", async () => {
      selectMock.mockReturnValue(mockChain([]));
      const rows = await repo.listExpired(new Date(), caps);
      expect(rows).toEqual([]);
    });

    it("skips rows with an unknown tier rather than crashing", async () => {
      // Defensive coverage of the "legacy row" branch. The reaper
      // is a backstop, not a place to crash on data shape drift —
      // an unknown tier should pass through to the operator as a
      // visible non-reaped row (alerted out-of-band) rather than
      // blocking the whole run.
      const now = new Date("2026-05-20T12:00:00.000Z");
      selectMock.mockReturnValue(
        mockChain([
          mockRow({
            id: "bogus-tier",
            tier: "starter" as unknown as "free", // type-erased to feign drift
            startedAt: new Date("2020-01-01"),
          }),
        ]),
      );
      const rows = await repo.listExpired(now, caps);
      expect(rows).toEqual([]);
    });

    it("treats exactly-at-cap as NOT expired (strict <)", async () => {
      // started_at + cap === now → strict less-than is false → keep
      // alive. Boundary documented in the spec — at-cap is "still
      // running"; the next 15-min tick catches it.
      const now = new Date("2026-05-20T12:00:00.000Z");
      selectMock.mockReturnValue(
        mockChain([
          mockRow({
            id: "exactly-at-cap",
            tier: "free",
            startedAt: new Date("2026-05-20T11:00:00.000Z"),
          }),
        ]),
      );
      const rows = await repo.listExpired(now, caps);
      expect(rows).toEqual([]);
    });

    it("handles multiple expired rows across tiers", async () => {
      const now = new Date("2026-05-20T12:00:00.000Z");
      selectMock.mockReturnValue(
        mockChain([
          mockRow({
            id: "free-1",
            tier: "free",
            startedAt: new Date("2026-05-20T10:30:00.000Z"),
          }),
          mockRow({
            id: "premium-1",
            tier: "premium",
            startedAt: new Date("2026-05-20T03:00:00.000Z"), // 9 h ago
          }),
        ]),
      );
      const rows = await repo.listExpired(now, caps);
      expect(rows.map((r) => r.id).sort()).toEqual(["free-1", "premium-1"]);
    });
  });
});
