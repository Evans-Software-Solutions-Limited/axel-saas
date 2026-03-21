import { describe, it, expect } from "vitest";
import { PUBLIC_TIERS } from "../publicPricing";
import { waitlistSignupHref } from "@/lib/waitlist";

describe("PUBLIC_TIERS", () => {
  it("has Free, Premium, and Enterprise", () => {
    const ids = PUBLIC_TIERS.map((t) => t.id);
    expect(ids).toEqual(["free", "premium", "enterprise"]);
  });

  it("Free and Premium point at home waitlist with API tier", () => {
    const free = PUBLIC_TIERS.find((t) => t.id === "free")!;
    const premium = PUBLIC_TIERS.find((t) => t.id === "premium")!;
    expect(free.ctaHref).toBe(waitlistSignupHref("free"));
    expect(premium.ctaHref).toBe(waitlistSignupHref("pro"));
    expect(free.ctaExternal).toBe(false);
    expect(premium.ctaExternal).toBe(false);
  });

  it("Enterprise uses same waitlist CTA with enterprise tier", () => {
    const ent = PUBLIC_TIERS.find((t) => t.id === "enterprise")!;
    expect(ent.ctaLabel).toBe("Join waitlist");
    expect(ent.ctaHref).toBe(waitlistSignupHref("enterprise"));
    expect(ent.ctaExternal).toBe(false);
  });
});
