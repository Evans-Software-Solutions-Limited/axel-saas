/**
 * Tests for the TOOLS.md generator. Pure function — no mocks.
 */
import { describe, expect, it } from "vitest";
import { generateToolsMarkdown } from "../toolsGenerator";
import type { IntegrationMetadata } from "../../integrations/integrationRepository";

function integration(
  overrides: Partial<IntegrationMetadata> & {
    integrationId: string;
    status?: IntegrationMetadata["status"];
  },
): IntegrationMetadata {
  return {
    id: "int-" + overrides.integrationId,
    userId: "u-1",
    integrationId: overrides.integrationId,
    status: overrides.status ?? "connected",
    keyHint: overrides.keyHint ?? "abcd",
    label: overrides.label ?? null,
    connectedAt: new Date("2026-05-01T00:00:00Z"),
    lastCheckedAt: null,
    lastUsedAt: null,
    lastErrorCode: null,
    lastErrorMessageSafe: null,
    accountMetadata: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
  } as IntegrationMetadata;
}

describe("generateToolsMarkdown", () => {
  it("renders the empty-state placeholders when no integrations are connected", () => {
    const md = generateToolsMarkdown({ integrations: [], tier: "free" });
    expect(md).toMatch(/# TOOLS\.md/);
    expect(md).toMatch(/_No communication channels connected/);
    expect(md).toMatch(/_No tool integrations connected\._/);
    expect(md).toContain("Platform default");
    expect(md).toContain("provided by Axel (free tier)");
  });

  it("defaults tier to 'free' when omitted", () => {
    const md = generateToolsMarkdown({ integrations: [] });
    expect(md).toMatch(/free tier/);
  });

  it("buckets connected channels and tools into the right sections", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "telegram-bot" }),
        integration({ integrationId: "google" }),
        integration({ integrationId: "slack" }),
        integration({ integrationId: "github" }),
      ],
      tier: "premium",
    });
    const channelsBlock = md
      .split("## Channels")[1]!
      .split("## Integrations")[0]!;
    const toolsBlock = md
      .split("## Integrations")[1]!
      .split("## AI Models")[0]!;

    // Channels: Slack + Telegram (alphabetical)
    expect(channelsBlock).toMatch(/Slack/);
    expect(channelsBlock).toMatch(/Telegram/);
    expect(channelsBlock).not.toMatch(/Google/);

    // Tools: GitHub + Google
    expect(toolsBlock).toMatch(/GitHub/);
    expect(toolsBlock).toMatch(/Google/);
    expect(toolsBlock).not.toMatch(/Slack/);
  });

  it("sorts entries within a section alphabetically", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "github" }),
        integration({ integrationId: "google" }),
        integration({ integrationId: "elevenlabs" }),
      ],
      tier: "free",
    });
    const tools = md.split("## Integrations")[1]!.split("## AI Models")[0]!;
    const elevenIdx = tools.indexOf("ElevenLabs");
    const githubIdx = tools.indexOf("GitHub");
    const googleIdx = tools.indexOf("Google");
    expect(elevenIdx).toBeGreaterThan(0);
    expect(elevenIdx).toBeLessThan(githubIdx);
    expect(githubIdx).toBeLessThan(googleIdx);
  });

  it("excludes revoked / non-connected integrations", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "telegram-bot", status: "revoked" }),
        integration({ integrationId: "google", status: "error" }),
      ],
      tier: "free",
    });
    expect(md).toMatch(/_No communication channels connected/);
    expect(md).toMatch(/_No tool integrations connected\._/);
  });

  it("ignores unknown integration ids (no display metadata)", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "wholly-made-up-id" as never }),
        integration({ integrationId: "slack" }),
      ],
      tier: "free",
    });
    expect(md).toMatch(/Slack/);
    expect(md).not.toMatch(/wholly-made-up-id/);
  });

  it("appends the user's label in brackets when present", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "slack", label: "Acme workspace" }),
      ],
      tier: "premium",
    });
    expect(md).toMatch(/Slack.*\[Acme workspace\]/);
  });

  it("renders BYOM in the AI Models section when openai is connected", () => {
    const md = generateToolsMarkdown({
      integrations: [integration({ integrationId: "openai", keyHint: "X9k2" })],
      tier: "premium",
    });
    expect(md).toMatch(/Bring your own model: OpenAI/);
    expect(md).toMatch(/key ending …X9k2/);
    expect(md).not.toMatch(/Platform default/);
  });

  it("renders BYOM for anthropic without leaking the full key", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "anthropic", keyHint: "abcd" }),
      ],
      tier: "enterprise",
    });
    expect(md).toMatch(/Bring your own model: Anthropic/);
    expect(md).toMatch(/key ending …abcd/);
  });

  it("renders both BYOM providers when both are connected", () => {
    const md = generateToolsMarkdown({
      integrations: [
        integration({ integrationId: "openai", keyHint: "1111" }),
        integration({ integrationId: "anthropic", keyHint: "2222" }),
      ],
      tier: "premium",
    });
    expect(md).toMatch(/OpenAI/);
    expect(md).toMatch(/Anthropic/);
    expect(md).not.toMatch(/Platform default/);
  });

  it("falls back gracefully when keyHint is empty", () => {
    const md = generateToolsMarkdown({
      integrations: [integration({ integrationId: "openai", keyHint: "" })],
      tier: "premium",
    });
    expect(md).toMatch(/Bring your own model: OpenAI/);
    expect(md).not.toMatch(/key ending/);
  });

  it("is byte-stable for the same inputs (idempotent regeneration)", () => {
    const a = generateToolsMarkdown({
      integrations: [integration({ integrationId: "slack", label: "Acme" })],
      tier: "premium",
    });
    const b = generateToolsMarkdown({
      integrations: [integration({ integrationId: "slack", label: "Acme" })],
      tier: "premium",
    });
    expect(a).toBe(b);
  });
});
