import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenUsageService } from "../tokenUsageService";
import type { TokenUsageRepository } from "../tokenUsageRepository";

const NOW = new Date("2026-05-03T15:00:00.000Z");

function setup(opts?: {
  daily?: { inputTokens: number; outputTokens: number };
  monthly?: { inputTokens: number; outputTokens: number };
  now?: Date;
}) {
  const repo = {
    incrementUsage: vi.fn().mockResolvedValue(undefined),
    getDailyTotals: vi
      .fn()
      .mockResolvedValue(opts?.daily ?? { inputTokens: 0, outputTokens: 0 }),
    getRangeTotals: vi
      .fn()
      .mockResolvedValue(opts?.monthly ?? { inputTokens: 0, outputTokens: 0 }),
  };
  const service = new TokenUsageService({
    repo: repo as unknown as TokenUsageRepository,
    now: () => opts?.now ?? NOW,
  });
  return { service, repo };
}

describe("TokenUsageService.checkCap", () => {
  beforeEach(() => vi.clearAllMocks());

  it("free tier: allows when projected usage is below the daily cap", async () => {
    const { service } = setup({
      daily: { inputTokens: 1_000, outputTokens: 500 },
    });
    const result = await service.checkCap("user-1", "free", {
      inputTokens: 100,
      outputTokens: 50,
    });
    expect(result.allowed).toBe(true);
  });

  it("free tier: denies when projected input tokens reach the daily cap", async () => {
    const { service } = setup({
      // 49,950 used + 100 about-to-send = 50,050 → over the 50,000 input cap.
      daily: { inputTokens: 49_950, outputTokens: 0 },
    });
    const result = await service.checkCap("user-1", "free", {
      inputTokens: 100,
      outputTokens: 0,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.scope).toBe("daily");
      expect(result.reason.toLowerCase()).toContain("daily");
      expect(result.resetAt).toBe("2026-05-04T00:00:00.000Z");
    }
  });

  it("free tier: denies when projected output tokens reach the daily cap", async () => {
    const { service } = setup({
      daily: { inputTokens: 0, outputTokens: 24_950 },
    });
    const result = await service.checkCap("user-1", "free", {
      inputTokens: 0,
      outputTokens: 100,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.scope).toBe("daily");
    }
  });

  it("free tier: 'reset at midnight UTC' rolls into the next day correctly", async () => {
    const { service } = setup({
      daily: { inputTokens: 50_000, outputTokens: 0 },
      now: new Date("2026-05-31T23:59:00.000Z"),
    });
    const result = await service.checkCap("user-1", "free", {
      inputTokens: 1,
      outputTokens: 0,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      // Last day of the month — midnight UTC rolls into the 1st of the
      // next month.
      expect(result.resetAt).toBe("2026-06-01T00:00:00.000Z");
    }
  });

  it("free tier: treats null subscription tier as free (cap enforced)", async () => {
    const { service } = setup({
      daily: { inputTokens: 50_000, outputTokens: 0 },
    });
    const result = await service.checkCap("user-1", null, {
      inputTokens: 1,
      outputTokens: 0,
    });
    expect(result.allowed).toBe(false);
  });

  it("premium tier: allows when monthly usage is well below the cap", async () => {
    const { service } = setup({
      monthly: { inputTokens: 1_000_000, outputTokens: 500_000 },
    });
    const result = await service.checkCap("user-1", "premium", {
      inputTokens: 1_000,
      outputTokens: 500,
    });
    expect(result.allowed).toBe(true);
  });

  it("premium tier: denies when projected monthly input reaches the cap", async () => {
    const { service } = setup({
      monthly: { inputTokens: 1_999_999, outputTokens: 0 },
    });
    const result = await service.checkCap("user-1", "premium", {
      inputTokens: 1,
      outputTokens: 0,
    });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.scope).toBe("monthly");
      expect(result.resetAt).toBe("2026-06-01T00:00:00.000Z");
    }
  });

  it("premium tier: does not apply a daily cap", async () => {
    // Even very high daily usage doesn't deny premium — only monthly matters.
    const { service } = setup({
      daily: { inputTokens: 10_000_000, outputTokens: 5_000_000 },
      monthly: { inputTokens: 0, outputTokens: 0 },
    });
    const result = await service.checkCap("user-1", "premium", {
      inputTokens: 100,
      outputTokens: 50,
    });
    expect(result.allowed).toBe(true);
  });

  it("enterprise tier: never denies (no caps)", async () => {
    const { service } = setup();
    const result = await service.checkCap("user-1", "enterprise", {
      inputTokens: 999_999_999,
      outputTokens: 999_999_999,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("TokenUsageService.recordUsage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards to the repository with today's UTC date", async () => {
    const { service, repo } = setup();
    await service.recordUsage({
      userId: "user-1",
      inputTokens: 200,
      outputTokens: 100,
      model: "anthropic/haiku",
      source: "chat",
    });
    expect(repo.incrementUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        usageDate: "2026-05-03",
        inputTokens: 200,
        outputTokens: 100,
        model: "anthropic/haiku",
        source: "chat",
      }),
    );
  });

  it("defaults model and source when omitted", async () => {
    const { service, repo } = setup();
    await service.recordUsage({
      userId: "user-1",
      inputTokens: 1,
      outputTokens: 1,
    });
    const call = repo.incrementUsage.mock.calls[0]![0];
    expect(call.model).toBe("unknown");
    expect(call.source).toBe("chat");
  });

  it("clamps negative or fractional token counts to safe integers", async () => {
    const { service, repo } = setup();
    await service.recordUsage({
      userId: "user-1",
      inputTokens: -5,
      outputTokens: 1.7,
    });
    const call = repo.incrementUsage.mock.calls[0]![0];
    expect(call.inputTokens).toBe(0);
    expect(call.outputTokens).toBe(1);
  });

  it("skips the DB write entirely when both counts are zero", async () => {
    const { service, repo } = setup();
    await service.recordUsage({
      userId: "user-1",
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(repo.incrementUsage).not.toHaveBeenCalled();
  });
});

describe("TokenUsageService.getSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("free: surfaces daily totals + limits and computes percentUsed", async () => {
    const { service } = setup({
      daily: { inputTokens: 25_000, outputTokens: 0 },
    });
    const summary = await service.getSummary("user-1", "free");
    expect(summary.tier).toBe("free");
    expect(summary.daily.limits).toEqual({
      inputTokens: 50_000,
      outputTokens: 25_000,
    });
    expect(summary.monthly.limits).toBeNull();
    // 25,000 / 50,000 = 0.5
    expect(summary.percentUsed).toBeCloseTo(0.5, 5);
  });

  it("premium: surfaces monthly totals + limits", async () => {
    const { service } = setup({
      monthly: { inputTokens: 1_500_000, outputTokens: 0 },
    });
    const summary = await service.getSummary("user-1", "premium");
    expect(summary.tier).toBe("premium");
    expect(summary.daily.limits).toBeNull();
    expect(summary.monthly.limits).toEqual({
      inputTokens: 2_000_000,
      outputTokens: 1_000_000,
    });
    // 1.5M / 2M = 0.75
    expect(summary.percentUsed).toBeCloseTo(0.75, 5);
  });

  it("enterprise: percentUsed is null (no cap)", async () => {
    const { service } = setup({
      daily: { inputTokens: 100_000_000, outputTokens: 0 },
      monthly: { inputTokens: 100_000_000, outputTokens: 0 },
    });
    const summary = await service.getSummary("user-1", "enterprise");
    expect(summary.percentUsed).toBeNull();
    expect(summary.daily.limits).toBeNull();
    expect(summary.monthly.limits).toBeNull();
  });

  it("treats a missing subscription tier as free", async () => {
    const { service } = setup();
    const summary = await service.getSummary("user-1", null);
    expect(summary.tier).toBe("free");
    expect(summary.daily.limits).not.toBeNull();
  });

  it("uses the higher of input/output ratio when computing percentUsed", async () => {
    // 25k / 50k = 0.5 input ratio. 24k / 25k = 0.96 output ratio.
    // Higher of the two should win — output is at risk of being capped first.
    const { service } = setup({
      daily: { inputTokens: 25_000, outputTokens: 24_000 },
    });
    const summary = await service.getSummary("user-1", "free");
    expect(summary.percentUsed).toBeCloseTo(0.96, 2);
  });
});
