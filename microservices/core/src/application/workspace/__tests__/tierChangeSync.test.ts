/**
 * Tests for the Stripe tier-change → workspace regen orchestrator.
 *
 * Covers:
 *   - AGENTS.md regenerated unconditionally (tier-only file)
 *   - SOUL.md regenerated when onboarding answers exist
 *   - SOUL.md skipped when answers are missing (with logger.info breadcrumb)
 *   - TOOLS.md regenerated from current integrations + new tier
 *   - openclaw.json regenerated via the shared helper (merge w/ on-disk)
 *   - openclaw.json skipped cleanly when malformed (other files still go through)
 *   - All file updates land in a SINGLE updateFiles call (one reload signal)
 *   - Reason is always "tier_changed"
 *   - Updates carry the NEW tier's values, not the old
 */

import { describe, expect, it, vi } from "vitest";
import { syncWorkspaceAfterTierChange } from "../tierChangeSync";
import {
  serializeOpenClawConfig,
  generateOpenClawConfig,
} from "../openclawConfigGenerator";
import type { IntegrationMetadata } from "../../integrations/integrationRepository";

function makeWorkspaceServiceStub(opts?: { existingOpenClaw?: string | null }) {
  return {
    updateFiles: vi.fn().mockResolvedValue(undefined),
    readWorkspaceFile: vi
      .fn()
      .mockResolvedValue(opts?.existingOpenClaw ?? null),
  };
}

function makeUserRepoStub(answers: Record<string, unknown> | null) {
  return {
    getOnboardingAnswers: vi.fn().mockResolvedValue(answers),
  };
}

function makeIntegrationServiceStub(integrations: IntegrationMetadata[]) {
  return {
    list: vi.fn().mockResolvedValue(integrations),
  };
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn() };
}

const SAMPLE_ANSWERS = {
  name: "Brad",
  helpWith: "scheduling and triage",
  proactiveAreas: "calendar conflicts",
};

const SAMPLE_INTEGRATIONS: IntegrationMetadata[] = [
  {
    id: "i1",
    userId: "u-1",
    integrationId: "slack",
    status: "connected",
    keyHint: "abcd",
    label: null,
    connectedAt: new Date("2026-05-01T00:00:00Z"),
    lastCheckedAt: null,
    lastUsedAt: null,
    lastErrorCode: null,
    lastErrorMessageSafe: null,
    accountMetadata: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
  } as IntegrationMetadata,
];

describe("syncWorkspaceAfterTierChange", () => {
  it("writes AGENTS.md + SOUL.md + TOOLS.md + openclaw.json in a single updateFiles call", async () => {
    const ws = makeWorkspaceServiceStub();
    await syncWorkspaceAfterTierChange(
      {
        userRepository: makeUserRepoStub(SAMPLE_ANSWERS),
        integrationService: makeIntegrationServiceStub(SAMPLE_INTEGRATIONS),
        workspaceConfigService: ws,
        logger: makeLogger(),
      },
      "u-1",
      "premium",
    );

    // Exactly one updateFiles call — one reload signal per spec.
    expect(ws.updateFiles).toHaveBeenCalledOnce();
    const [userId, updates, reason] = ws.updateFiles.mock.calls[0];
    expect(userId).toBe("u-1");
    expect(reason).toBe("tier_changed");

    // All four files present.
    const filenames = (updates as { filename: string }[]).map(
      (u) => u.filename,
    );
    expect(filenames.sort()).toEqual(
      ["AGENTS.md", "SOUL.md", "TOOLS.md", "openclaw.json"].sort(),
    );
  });

  it("skips SOUL.md and logs an info breadcrumb when onboarding answers are missing", async () => {
    const ws = makeWorkspaceServiceStub();
    const logger = makeLogger();
    await syncWorkspaceAfterTierChange(
      {
        userRepository: makeUserRepoStub(null), // no answers
        integrationService: makeIntegrationServiceStub([]),
        workspaceConfigService: ws,
        logger,
      },
      "u-1",
      "free",
    );

    const updates = ws.updateFiles.mock.calls[0][1] as { filename: string }[];
    const filenames = updates.map((u) => u.filename);
    // SOUL.md is absent. AGENTS.md, TOOLS.md, openclaw.json still go through.
    expect(filenames).not.toContain("SOUL.md");
    expect(filenames).toContain("AGENTS.md");
    expect(filenames).toContain("TOOLS.md");
    expect(filenames).toContain("openclaw.json");

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("skipping SOUL.md"),
      expect.objectContaining({ userId: "u-1", newTier: "free" }),
    );
  });

  it("uses the NEW tier (not whatever the existing files said) for content", async () => {
    // Pre-existing openclaw.json says haiku (free). Bumping to premium
    // should produce content with sonnet (the premium model).
    const existingFreeConfig = serializeOpenClawConfig(
      generateOpenClawConfig("free"),
    );
    const ws = makeWorkspaceServiceStub({
      existingOpenClaw: existingFreeConfig,
    });

    await syncWorkspaceAfterTierChange(
      {
        userRepository: makeUserRepoStub(SAMPLE_ANSWERS),
        integrationService: makeIntegrationServiceStub([]),
        workspaceConfigService: ws,
        logger: makeLogger(),
      },
      "u-1",
      "premium",
    );

    const updates = ws.updateFiles.mock.calls[0][1] as {
      filename: string;
      content: string;
    }[];
    const openClawUpdate = updates.find((u) => u.filename === "openclaw.json");
    expect(openClawUpdate).toBeDefined();
    // The merged config should carry the premium model. We don't pin
    // the exact string here (would couple this test to the generator's
    // internals) — just assert it's different from the haiku/free version.
    expect(openClawUpdate!.content).not.toEqual(existingFreeConfig);
    expect(openClawUpdate!.content).toContain("sonnet");
  });

  it("skips openclaw.json regen cleanly when the on-disk file is malformed", async () => {
    // Malformed → openclawJsonRegen returns null → updates array
    // doesn't include openclaw.json. The other three files still go
    // through; we don't want a malformed file to block the entire
    // tier-change refresh.
    const ws = makeWorkspaceServiceStub({
      existingOpenClaw: "{not valid json",
    });
    const logger = makeLogger();

    await syncWorkspaceAfterTierChange(
      {
        userRepository: makeUserRepoStub(SAMPLE_ANSWERS),
        integrationService: makeIntegrationServiceStub([]),
        workspaceConfigService: ws,
        logger,
      },
      "u-1",
      "premium",
    );

    const updates = ws.updateFiles.mock.calls[0][1] as { filename: string }[];
    const filenames = updates.map((u) => u.filename);
    expect(filenames).not.toContain("openclaw.json");
    expect(filenames).toEqual(
      expect.arrayContaining(["AGENTS.md", "SOUL.md", "TOOLS.md"]),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("malformed"),
      expect.any(Object),
    );
  });

  it("TOOLS.md reflects current integrations + new tier (BYOM regen)", async () => {
    // Tier change from free → premium with openai connected. TOOLS.md
    // should reflect BYOM enablement (premium gate unlocks openai).
    // We don't pin the exact wording — just assert TOOLS.md was
    // regenerated using both signals (integrations + tier).
    const openaiConnected: IntegrationMetadata[] = [
      {
        id: "i-openai",
        userId: "u-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "sk-...",
        label: null,
        connectedAt: new Date("2026-05-01T00:00:00Z"),
        lastCheckedAt: null,
        lastUsedAt: null,
        lastErrorCode: null,
        lastErrorMessageSafe: null,
        accountMetadata: null,
        createdAt: new Date("2026-05-01T00:00:00Z"),
        updatedAt: new Date("2026-05-01T00:00:00Z"),
      } as IntegrationMetadata,
    ];
    const integrationService = makeIntegrationServiceStub(openaiConnected);
    const ws = makeWorkspaceServiceStub();

    await syncWorkspaceAfterTierChange(
      {
        userRepository: makeUserRepoStub(null),
        integrationService,
        workspaceConfigService: ws,
        logger: makeLogger(),
      },
      "u-1",
      "premium",
    );

    // integrationService.list was called for the user (TOOLS.md
    // generation depends on it).
    expect(integrationService.list).toHaveBeenCalledWith("u-1");

    const updates = ws.updateFiles.mock.calls[0][1] as {
      filename: string;
      content: string;
    }[];
    const toolsUpdate = updates.find((u) => u.filename === "TOOLS.md");
    expect(toolsUpdate).toBeDefined();
    expect(toolsUpdate!.content.length).toBeGreaterThan(0);
  });

  it("AGENTS.md content varies by tier (free vs enterprise)", async () => {
    // Sanity that the orchestrator is actually passing the tier into
    // generateAgentsContent. Without this assertion, a regression
    // that wires the OLD tier through (e.g. an accidental reuse of
    // sub.tier instead of nextTier) would pass the other tests above
    // because they don't compare across tiers.
    const wsFree = makeWorkspaceServiceStub();
    const wsEnt = makeWorkspaceServiceStub();
    const deps = (ws: ReturnType<typeof makeWorkspaceServiceStub>) => ({
      userRepository: makeUserRepoStub(null),
      integrationService: makeIntegrationServiceStub([]),
      workspaceConfigService: ws,
      logger: makeLogger(),
    });

    await syncWorkspaceAfterTierChange(deps(wsFree), "u-1", "free");
    await syncWorkspaceAfterTierChange(deps(wsEnt), "u-1", "enterprise");

    const agentsFree = (
      wsFree.updateFiles.mock.calls[0][1] as {
        filename: string;
        content: string;
      }[]
    ).find((u) => u.filename === "AGENTS.md")!.content;
    const agentsEnt = (
      wsEnt.updateFiles.mock.calls[0][1] as {
        filename: string;
        content: string;
      }[]
    ).find((u) => u.filename === "AGENTS.md")!.content;

    expect(agentsFree).not.toEqual(agentsEnt);
  });

  it("propagates a write failure so the caller can decide whether to ack the Stripe event", async () => {
    // The Stripe handler wraps the call in try/catch so a write
    // failure here doesn't fail the webhook event — but the
    // orchestrator MUST throw rather than silently swallow, so the
    // wrapping is what owns the swallow decision.
    const ws = {
      updateFiles: vi.fn().mockRejectedValue(new Error("EFS unavailable")),
      readWorkspaceFile: vi.fn().mockResolvedValue(null),
    };
    await expect(
      syncWorkspaceAfterTierChange(
        {
          userRepository: makeUserRepoStub(null),
          integrationService: makeIntegrationServiceStub([]),
          workspaceConfigService: ws,
          logger: makeLogger(),
        },
        "u-1",
        "premium",
      ),
    ).rejects.toThrow(/EFS unavailable/);
  });
});
