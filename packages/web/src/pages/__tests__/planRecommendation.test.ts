import { describe, it, expect } from "vitest";
import { getRecommendedPlan, PLANS } from "../planRecommendation";

describe("getRecommendedPlan", () => {
  it("returns a recommendation with a tierId matching a known plan", () => {
    const rec = getRecommendedPlan();
    const match = PLANS.find((p) => p.tierId === rec.tierId);
    expect(match).toBeDefined();
  });

  it("returns a non-empty reason", () => {
    const rec = getRecommendedPlan();
    expect(rec.reason.length).toBeGreaterThan(10);
  });

  it("returns a non-empty shortReason", () => {
    const rec = getRecommendedPlan();
    expect(rec.shortReason.length).toBeGreaterThan(0);
  });

  it("is deterministic — returns the same result on repeated calls", () => {
    const first = getRecommendedPlan();
    const second = getRecommendedPlan();
    expect(first.tierId).toBe(second.tierId);
    expect(first.reason).toBe(second.reason);
    expect(first.shortReason).toBe(second.shortReason);
  });
});

describe("PLANS", () => {
  it("contains at least 4 paid tiers", () => {
    const paid = PLANS.filter((p) => p.tierId !== null);
    expect(paid.length).toBeGreaterThanOrEqual(4);
  });

  it("each plan has a non-empty description and tagline", () => {
    PLANS.forEach((plan) => {
      expect(plan.description.length).toBeGreaterThan(0);
      expect(plan.tagline.length).toBeGreaterThan(0);
    });
  });

  it("each plan has at least one feature", () => {
    PLANS.forEach((plan) => {
      expect(plan.features.length).toBeGreaterThanOrEqual(1);
    });
  });
});
