import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitService } from "../rateLimitService";
import type { RateLimitClient } from "../rateLimitClient";

// 2026-05-03T12:00:30Z is well inside the minute-aligned bucket
// 1777809600 (= 2026-05-03T12:00:00Z). 30s in, so retryAfter == 30.
const NOW = new Date("2026-05-03T12:00:30.000Z");
const NOW_SEC = Math.floor(NOW.getTime() / 1000);
const WINDOW_START = NOW_SEC - (NOW_SEC % 60);
const WINDOW_END = WINDOW_START + 60;

function setup(opts?: {
  clientResult?: { allowed: boolean; count: number };
  clientError?: Error;
  now?: Date;
}) {
  const client: RateLimitClient = {
    incrementAndCheck: vi.fn().mockImplementation(async () => {
      if (opts?.clientError) throw opts.clientError;
      return opts?.clientResult ?? { allowed: true, count: 1 };
    }),
  };
  const service = new RateLimitService({
    client,
    now: () => opts?.now ?? NOW,
  });
  return { service, client };
}

beforeEach(() => vi.clearAllMocks());

describe("RateLimitService.checkAndConsume", () => {
  it("returns allowed + correct headers for a fresh bucket on chat/free", async () => {
    const { service, client } = setup();

    const decision = await service.checkAndConsume({
      userId: "user-1",
      category: "chat",
      tier: "free",
    });

    expect(decision.allowed).toBe(true);
    expect(decision.limit).toBe(10);
    expect(decision.remaining).toBe(9);
    expect(decision.resetAt).toBe(WINDOW_END);
    // 30 seconds left in this minute.
    expect(decision.retryAfter).toBe(30);

    expect(client.incrementAndCheck).toHaveBeenCalledWith({
      bucketKey: `user-1#chat#${WINDOW_START}`,
      limit: 10,
      // TTL = window start + bucket ttl (90s).
      ttlSeconds: WINDOW_START + 90,
    });
  });

  it("uses the premium chat limit (30) when tier=premium", async () => {
    const { service } = setup({ clientResult: { allowed: true, count: 5 } });
    const decision = await service.checkAndConsume({
      userId: "user-1",
      category: "chat",
      tier: "premium",
    });
    expect(decision.limit).toBe(30);
    expect(decision.remaining).toBe(25);
  });

  it("treats null tier as free (no subscription row yet)", async () => {
    const { service } = setup();
    const decision = await service.checkAndConsume({
      userId: "user-1",
      category: "write",
      tier: null,
    });
    expect(decision.limit).toBe(5);
  });

  it("returns blocked + remaining=0 when DDB reports cap hit", async () => {
    const { service } = setup({ clientResult: { allowed: false, count: 10 } });
    const decision = await service.checkAndConsume({
      userId: "user-1",
      category: "chat",
      tier: "free",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    // retryAfter is still set so 429 responses can include Retry-After.
    expect(decision.retryAfter).toBeGreaterThan(0);
  });

  it("retryAfter is at least 1 second even at the very end of the window", async () => {
    // 2026-05-03T12:00:59.999Z — last millisecond of the minute. The
    // floor(now/1000) is still 12:00:59, so windowEnd - now = 1.
    const { service } = setup({
      now: new Date("2026-05-03T12:00:59.999Z"),
    });
    const decision = await service.checkAndConsume({
      userId: "user-1",
      category: "read",
      tier: "free",
    });
    expect(decision.retryAfter).toBeGreaterThanOrEqual(1);
  });

  it("does not let DDB errors silently swallow into 'allowed'", async () => {
    const { service } = setup({ clientError: new Error("DDB unreachable") });
    await expect(
      service.checkAndConsume({
        userId: "user-1",
        category: "chat",
        tier: "free",
      }),
    ).rejects.toThrow("DDB unreachable");
    // The handler decides what to do with the rejection — fail-closed
    // (return 503) or fail-open (log + continue). The service must not
    // pre-empt that choice by returning `allowed: true` on errors.
  });

  it("buckets each minute separately", async () => {
    const oneMinLater = new Date(NOW.getTime() + 60_000);
    const { service: serviceA, client: clientA } = setup();
    const { service: serviceB, client: clientB } = setup({
      now: oneMinLater,
    });

    await serviceA.checkAndConsume({
      userId: "user-1",
      category: "chat",
      tier: "free",
    });
    await serviceB.checkAndConsume({
      userId: "user-1",
      category: "chat",
      tier: "free",
    });

    const keyA = (clientA.incrementAndCheck as ReturnType<typeof vi.fn>).mock
      .calls[0]![0].bucketKey;
    const keyB = (clientB.incrementAndCheck as ReturnType<typeof vi.fn>).mock
      .calls[0]![0].bucketKey;
    expect(keyA).not.toBe(keyB);
  });

  it("each category has its own bucket (chat doesn't drain read)", async () => {
    const { service, client } = setup();
    await service.checkAndConsume({
      userId: "user-1",
      category: "chat",
      tier: "free",
    });
    await service.checkAndConsume({
      userId: "user-1",
      category: "read",
      tier: "free",
    });
    const calls = (client.incrementAndCheck as ReturnType<typeof vi.fn>).mock
      .calls;
    expect(calls[0]![0].bucketKey).toContain("#chat#");
    expect(calls[1]![0].bucketKey).toContain("#read#");
  });
});
