import { describe, it, expect } from "vitest";
import { TOKEN_BUDGETS, estimateTokens, getBudget } from "../tokenBudgets";

describe("TOKEN_BUDGETS", () => {
  it("free tier enforces a daily cap, no monthly cap", () => {
    expect(TOKEN_BUDGETS.free.daily).toBeDefined();
    expect(TOKEN_BUDGETS.free.monthly).toBeUndefined();
    expect(TOKEN_BUDGETS.free.daily?.inputTokens).toBeGreaterThan(0);
    expect(TOKEN_BUDGETS.free.daily?.outputTokens).toBeGreaterThan(0);
  });

  it("premium tier enforces a monthly cap, no daily cap", () => {
    expect(TOKEN_BUDGETS.premium.monthly).toBeDefined();
    expect(TOKEN_BUDGETS.premium.daily).toBeUndefined();
    expect(TOKEN_BUDGETS.premium.monthly?.inputTokens).toBeGreaterThan(
      TOKEN_BUDGETS.free.daily?.inputTokens ?? 0,
    );
  });

  it("enterprise tier has no caps", () => {
    expect(TOKEN_BUDGETS.enterprise.daily).toBeUndefined();
    expect(TOKEN_BUDGETS.enterprise.monthly).toBeUndefined();
  });

  it("warning threshold is between 0 and 1 for every tier", () => {
    for (const budget of Object.values(TOKEN_BUDGETS)) {
      expect(budget.warningThreshold).toBeGreaterThan(0);
      expect(budget.warningThreshold).toBeLessThanOrEqual(1);
    }
  });
});

describe("getBudget", () => {
  it("returns the matching tier's budget", () => {
    expect(getBudget("free")).toBe(TOKEN_BUDGETS.free);
    expect(getBudget("premium")).toBe(TOKEN_BUDGETS.premium);
    expect(getBudget("enterprise")).toBe(TOKEN_BUDGETS.enterprise);
  });

  it("falls back to the Free budget when no tier is found", () => {
    // A freshly-confirmed user can land before /subscriptions/free has
    // fired. Treating null as Free keeps the cap honest in that window.
    expect(getBudget(null)).toBe(TOKEN_BUDGETS.free);
  });
});

describe("estimateTokens", () => {
  it("returns 0 for empty input", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("rounds up to whole tokens", () => {
    // 5 chars / 4 = 1.25 → 2
    expect(estimateTokens("hello")).toBe(2);
  });

  it("scales linearly with text length (~chars/4)", () => {
    expect(estimateTokens("a".repeat(40))).toBe(10);
    expect(estimateTokens("a".repeat(41))).toBe(11);
  });
});
