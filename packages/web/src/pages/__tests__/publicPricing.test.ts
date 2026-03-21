import { describe, it, expect } from "vitest";
import { PUBLIC_TIERS } from "../publicPricing";
import { waitlistSignupHref } from "@/lib/waitlist";

describe("PUBLIC_TIERS", () => {
  it("has Free, Premium, and Enterprise", () => {
    const ids = PUBLIC_TIERS.map((t) => t.id);
    expect(ids).toEqual(["free", "premium", "enterprise"]);
  });

  it("marks exactly one tier as highlight", () => {
    expect(PUBLIC_TIERS.filter((t) => t.highlight).length).toBe(1);
  });

  it("Free and Premium point at home waitlist with API tier", () => {
    const free = PUBLIC_TIERS.find((t) => t.id === "free")!;
    const premium = PUBLIC_TIERS.find((t) => t.id === "premium")!;
    expect(free.ctaHref).toBe(waitlistSignupHref("free"));
    expect(premium.ctaHref).toBe(waitlistSignupHref("pro"));
    expect(free.ctaExternal).toBe(false);
    expect(premium.ctaExternal).toBe(false);
  });

  it("Enterprise uses external mailto CTA", () => {
    const ent = PUBLIC_TIERS.find((t) => t.id === "enterprise")!;
    expect(ent.ctaExternal).toBe(true);
    expect(ent.ctaHref.startsWith("mailto:")).toBe(true);
  });
});
