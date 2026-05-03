import { describe, it, expect } from "vitest";
import {
  OUTPUT_PROJECTION_FLOOR_TOKENS,
  OUTPUT_PROJECTION_MULTIPLIER,
  TOKEN_BUDGETS,
  estimateTokens,
  getBudget,
  projectOutputTokens,
} from "../tokenBudgets";

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

describe("projectOutputTokens", () => {
  it("uses the multiplier when input * multiplier is above the floor", () => {
    // input × 5 = 500, well above the 200-token floor.
    expect(projectOutputTokens(100)).toBe(100 * OUTPUT_PROJECTION_MULTIPLIER);
  });

  it("falls back to the floor for tiny inputs", () => {
    // A 5-token prompt would project to 25 tokens by the multiplier
    // alone — well under the floor — but a "summarise the last 24h"
    // prompt can produce a 500-token response. Floor catches this.
    expect(projectOutputTokens(5)).toBe(OUTPUT_PROJECTION_FLOOR_TOKENS);
  });

  it("returns the floor for zero input", () => {
    expect(projectOutputTokens(0)).toBe(OUTPUT_PROJECTION_FLOOR_TOKENS);
  });

  it("treats negative input as zero", () => {
    expect(projectOutputTokens(-10)).toBe(OUTPUT_PROJECTION_FLOOR_TOKENS);
  });

  it("never under-projects relative to the input estimate", () => {
    // Sanity check on the assumption baked into the multiplier:
    // projected output should always be >= projected input. That's
    // the whole point — assistant responses are typically several
    // times longer than the user prompt.
    for (const input of [1, 10, 100, 1_000, 10_000]) {
      expect(projectOutputTokens(input)).toBeGreaterThanOrEqual(input);
    }
  });
});

describe("OUTPUT_PROJECTION_MULTIPLIER", () => {
  it("is at least 2x so the projection meaningfully exceeds the input", () => {
    expect(OUTPUT_PROJECTION_MULTIPLIER).toBeGreaterThanOrEqual(2);
  });
});
