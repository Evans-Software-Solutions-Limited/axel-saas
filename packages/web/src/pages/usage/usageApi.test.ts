import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUsageSummary } from "./usageApi";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    core: {
      users: {
        me: {
          usage: { get: vi.fn() },
        },
      },
    },
  },
}));

vi.mock("@/lib/eden", () => ({ api: mockApi }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchUsageSummary", () => {
  it("returns the usage payload on success", async () => {
    mockApi.core.users.me.usage.get.mockResolvedValue({
      data: {
        success: true,
        usage: {
          tier: "free",
          daily: {
            inputTokens: 1000,
            outputTokens: 500,
            limits: { inputTokens: 50000, outputTokens: 25000 },
          },
          monthly: { inputTokens: 0, outputTokens: 0, limits: null },
          percentUsed: 0.02,
          warningThreshold: 0.8,
        },
      },
      error: null,
    } as never);

    const result = await fetchUsageSummary();
    expect(result?.tier).toBe("free");
    expect(result?.daily.limits?.inputTokens).toBe(50000);
  });

  it("returns null on 404 (user row not yet provisioned)", async () => {
    mockApi.core.users.me.usage.get.mockResolvedValue({
      data: null,
      error: { status: 404, value: { error: "User not found" } },
    } as never);

    const result = await fetchUsageSummary();
    expect(result).toBeNull();
  });

  it("throws on non-404 transport error", async () => {
    mockApi.core.users.me.usage.get.mockResolvedValue({
      data: null,
      error: { status: 500, value: { error: "boom" } },
    } as never);

    await expect(fetchUsageSummary()).rejects.toThrow(/500/);
  });

  it("throws when the body says success: false", async () => {
    mockApi.core.users.me.usage.get.mockResolvedValue({
      data: { success: false },
      error: null,
    } as never);

    await expect(fetchUsageSummary()).rejects.toThrow(/not successful/i);
  });

  it("throws when the body is missing the usage payload", async () => {
    mockApi.core.users.me.usage.get.mockResolvedValue({
      data: { success: true },
      error: null,
    } as never);

    await expect(fetchUsageSummary()).rejects.toThrow(/not successful/i);
  });
});
