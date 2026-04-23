import { describe, it, expect } from "vitest";
import { normaliseTier } from "../tierNormaliser";

describe("normaliseTier", () => {
  it("returns current enum values unchanged", () => {
    expect(normaliseTier("free")).toBe("free");
    expect(normaliseTier("premium")).toBe("premium");
    expect(normaliseTier("enterprise")).toBe("enterprise");
  });

  it("maps legacy 4-tier values to the new enum", () => {
    // Matches the 0008_tier_alignment SQL migration's CASE logic.
    expect(normaliseTier("starter")).toBe("free");
    expect(normaliseTier("pro")).toBe("premium");
    expect(normaliseTier("business")).toBe("premium");
    expect(normaliseTier("developer")).toBe("premium");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(normaliseTier("  Premium  ")).toBe("premium");
    expect(normaliseTier("PRO")).toBe("premium");
    expect(normaliseTier("Starter")).toBe("free");
  });

  it("returns null for unknown or non-string inputs", () => {
    expect(normaliseTier("gold")).toBeNull();
    expect(normaliseTier("")).toBeNull();
    expect(normaliseTier(null)).toBeNull();
    expect(normaliseTier(undefined)).toBeNull();
    expect(normaliseTier(42)).toBeNull();
    expect(normaliseTier({})).toBeNull();
  });
});
