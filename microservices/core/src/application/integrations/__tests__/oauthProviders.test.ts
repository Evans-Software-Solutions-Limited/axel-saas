import { describe, it, expect } from "vitest";
import {
  getOauthProvider,
  isOauthIntegration,
  listOauthIntegrationIds,
} from "../oauthProviders";

describe("oauthProviders", () => {
  it("returns config for google", () => {
    const cfg = getOauthProvider("google");
    expect(cfg).not.toBeNull();
    expect(cfg?.authorizationUrl).toContain("accounts.google.com");
    expect(cfg?.scopes.length).toBeGreaterThan(0);
  });

  it("returns config for slack", () => {
    const cfg = getOauthProvider("slack");
    expect(cfg).not.toBeNull();
    expect(cfg?.tokenUrl).toContain("slack.com");
  });

  it("returns null for non-OAuth integrations", () => {
    expect(getOauthProvider("openai")).toBeNull();
    expect(getOauthProvider("telegram-bot")).toBeNull();
    expect(getOauthProvider("github")).toBeNull();
  });

  it("returns null for unknown integration", () => {
    expect(getOauthProvider("nonexistent")).toBeNull();
  });

  it("isOauthIntegration mirrors getOauthProvider", () => {
    expect(isOauthIntegration("google")).toBe(true);
    expect(isOauthIntegration("slack")).toBe(true);
    expect(isOauthIntegration("openai")).toBe(false);
    expect(isOauthIntegration("nonexistent")).toBe(false);
  });

  it("listOauthIntegrationIds returns the registered providers", () => {
    const ids = listOauthIntegrationIds();
    expect(ids).toContain("google");
    expect(ids).toContain("slack");
    expect(ids).not.toContain("openai");
  });

  describe("authorizationExtras", () => {
    it("Google requests refresh tokens via access_type=offline + prompt=consent", () => {
      const cfg = getOauthProvider("google");
      expect(cfg?.authorizationExtras).toEqual({
        access_type: "offline",
        prompt: "consent",
      });
    });

    it("Slack does not declare authorize-time extras", () => {
      // Slack ignores access_type/prompt today but a future tightening
      // would reject them, so they must not be applied to its URL.
      const cfg = getOauthProvider("slack");
      expect(cfg?.authorizationExtras).toBeUndefined();
    });
  });

  describe("detectTokenResponseError", () => {
    it("Google does not declare a token-response error detector", () => {
      // Google returns 4xx on token-exchange errors, so the generic
      // exchange.ok check is enough — no per-provider detector needed.
      const cfg = getOauthProvider("google");
      expect(cfg?.detectTokenResponseError).toBeUndefined();
    });

    it("Slack flags { ok: false, error: <code> } and surfaces the code", () => {
      const cfg = getOauthProvider("slack");
      const detect = cfg?.detectTokenResponseError;
      expect(detect).toBeDefined();
      expect(detect?.({ ok: false, error: "invalid_code" })).toContain(
        "invalid_code",
      );
    });

    it("Slack falls back to a generic message when error code is missing", () => {
      const detect = getOauthProvider("slack")?.detectTokenResponseError;
      const msg = detect?.({ ok: false });
      expect(msg).toBeDefined();
      expect(msg?.toLowerCase()).toContain("slack");
    });

    it("Slack flags an empty payload as an error (defensive)", () => {
      const detect = getOauthProvider("slack")?.detectTokenResponseError;
      expect(detect?.(null)).not.toBeNull();
      expect(detect?.(undefined)).not.toBeNull();
    });

    it("Slack returns null on a healthy ok=true response", () => {
      const detect = getOauthProvider("slack")?.detectTokenResponseError;
      expect(detect?.({ ok: true, access_token: "xoxb-..." })).toBeNull();
    });
  });
});
