import { describe, it, expect } from "vitest";
import {
  checkIntegrationTierGate,
  isPremiumOnlyIntegration,
} from "../tierGate";

describe("isPremiumOnlyIntegration", () => {
  it("returns true for openai and anthropic", () => {
    expect(isPremiumOnlyIntegration("openai")).toBe(true);
    expect(isPremiumOnlyIntegration("anthropic")).toBe(true);
  });

  it("returns false for non-BYOM integrations", () => {
    expect(isPremiumOnlyIntegration("google")).toBe(false);
    expect(isPremiumOnlyIntegration("slack")).toBe(false);
    expect(isPremiumOnlyIntegration("telegram-bot")).toBe(false);
    expect(isPremiumOnlyIntegration("github")).toBe(false);
    expect(isPremiumOnlyIntegration("elevenlabs")).toBe(false);
  });

  it("returns false for unknown integrations", () => {
    expect(isPremiumOnlyIntegration("nope")).toBe(false);
  });
});

describe("checkIntegrationTierGate", () => {
  it("allows free-tier connections to non-BYOM integrations", () => {
    expect(checkIntegrationTierGate("google", "free")).toEqual({
      allowed: true,
    });
    expect(checkIntegrationTierGate("telegram-bot", "free")).toEqual({
      allowed: true,
    });
  });

  it("allows non-BYOM connections when no subscription is found", () => {
    expect(checkIntegrationTierGate("google", null)).toEqual({
      allowed: true,
    });
  });

  it("blocks free-tier connections to BYOM integrations", () => {
    const result = checkIntegrationTierGate("openai", "free");
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toContain("Premium");
    }
  });

  it("blocks BYOM connections when no subscription is found", () => {
    const result = checkIntegrationTierGate("anthropic", null);
    expect(result.allowed).toBe(false);
  });

  it("allows premium tier on BYOM integrations", () => {
    expect(checkIntegrationTierGate("openai", "premium")).toEqual({
      allowed: true,
    });
    expect(checkIntegrationTierGate("anthropic", "premium")).toEqual({
      allowed: true,
    });
  });

  it("allows enterprise tier on BYOM integrations", () => {
    expect(checkIntegrationTierGate("openai", "enterprise")).toEqual({
      allowed: true,
    });
  });
});
