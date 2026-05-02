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
});
