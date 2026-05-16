/**
 * Tests for the integrations → workspace sync orchestrator.
 *
 * The orchestrator now writes BOTH TOOLS.md and openclaw.json in a
 * single `updateFiles` call (one reload signal). The test suite
 * covers:
 *
 *   - TOOLS.md regen end-to-end (carry-over from PR #100)
 *   - openclaw.json regen with no existing file (first-regen case)
 *   - openclaw.json regen preserves runtime keys on the bridge plugin
 *     (the silent-failure-class defence the PR exists to provide)
 *   - openclaw.json regen on a tier upgrade flips the model
 *   - openclaw.json regen skips cleanly on malformed existing files,
 *     while TOOLS.md still goes through
 *   - Single updateFiles call (one reload, not two) when both files
 *     change
 */
import { describe, expect, it, vi } from "vitest";
import { syncWorkspaceAfterIntegrationChange } from "../integrationsSync";
import { serializeOpenClawConfig } from "../openclawConfigGenerator";
import { generateOpenClawConfig } from "../openclawConfigGenerator";
import type { IntegrationMetadata } from "../../integrations/integrationRepository";

const sampleConnected: IntegrationMetadata[] = [
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

function makeWorkspaceServiceStub(
  opts?: {
    existingOpenClaw?: string | null;
  } | null,
) {
  return {
    updateFiles: vi.fn().mockResolvedValue(undefined),
    readWorkspaceFile: vi
      .fn()
      .mockResolvedValue(opts?.existingOpenClaw ?? null),
  };
}

/**
 * Default noop logger for tests that don't care about logging
 * assertions — `logger` on `IntegrationsSyncDeps` is required (the
 * orchestrator's "openclaw.json malformed; skipping regen" warning
 * was silently dropping in production before bugbot caught it on
 * #104; making the type required forces every call site to think
 * about which logger to use).
 */
function makeNoopLogger() {
  return { warn: vi.fn() };
}

describe("syncWorkspaceAfterIntegrationChange", () => {
  it("regenerates TOOLS.md AND openclaw.json in a single updateFiles call", async () => {
    const integrationService = {
      list: vi.fn().mockResolvedValue(sampleConnected),
    };
    const workspaceConfigService = makeWorkspaceServiceStub();

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-1",
      "premium",
    );

    // ONE updateFiles call = ONE reload signal (the service fires
    // reload per call, not per file).
    expect(workspaceConfigService.updateFiles).toHaveBeenCalledOnce();
    const [userId, updates, reason] =
      workspaceConfigService.updateFiles.mock.calls[0]!;
    expect(userId).toBe("u-1");
    expect(updates).toHaveLength(2);
    const filenames = updates.map((u: { filename: string }) => u.filename);
    expect(filenames).toContain("TOOLS.md");
    expect(filenames).toContain("openclaw.json");
    expect(reason).toBe("integration_changed");
  });

  it("writes the canonical openclaw.json on first regen (no existing file)", async () => {
    const integrationService = { list: vi.fn().mockResolvedValue([]) };
    const workspaceConfigService = makeWorkspaceServiceStub({
      existingOpenClaw: null,
    });

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-1",
      "free",
    );

    const updates = workspaceConfigService.updateFiles.mock.calls[0]![1];
    const openClaw = updates.find(
      (u: { filename: string }) => u.filename === "openclaw.json",
    );
    expect(openClaw).toBeDefined();
    expect(openClaw!.content).toBe(
      serializeOpenClawConfig(generateOpenClawConfig("free")),
    );
  });

  it("preserves runtime-added keys on plugins.entries.axel-bridge across regen", async () => {
    // Simulate an active container where `openclaw plugins install
    // --link` has written runtime registry keys (`path`, `version`)
    // into the bridge plugin entry. The regen MUST carry those
    // through; clobbering them is the silent failure class this PR
    // exists to prevent.
    const existing = {
      gateway: {
        mode: "local",
        bind: "lan",
        port: 18789,
        controlUi: { dangerouslyAllowHostHeaderOriginFallback: true },
        http: { endpoints: { chatCompletions: { enabled: true } } },
      },
      agents: {
        defaults: {
          workspace: "/data/workspace",
          model: { primary: "anthropic/haiku" },
        },
      },
      plugins: {
        entries: {
          "axel-bridge": {
            enabled: true,
            config: {
              chatCompletionsBaseUrl: "http://127.0.0.1:18789",
              defaultModel: "openclaw",
            },
            // Runtime-added by `openclaw plugins install --link`.
            path: "/opt/axel-bridge",
            version: "0.0.0",
          },
        },
      },
    };

    const workspaceConfigService = makeWorkspaceServiceStub({
      existingOpenClaw: JSON.stringify(existing),
    });
    const integrationService = { list: vi.fn().mockResolvedValue([]) };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-1",
      "free",
    );

    const updates = workspaceConfigService.updateFiles.mock.calls[0]![1];
    const openClawUpdate = updates.find(
      (u: { filename: string }) => u.filename === "openclaw.json",
    );
    const written = JSON.parse(openClawUpdate!.content);
    expect(written.plugins.entries["axel-bridge"].path).toBe(
      "/opt/axel-bridge",
    );
    expect(written.plugins.entries["axel-bridge"].version).toBe("0.0.0");
    // Template-managed keys still match the generator.
    expect(written.plugins.entries["axel-bridge"].enabled).toBe(true);
    expect(written.plugins.entries["axel-bridge"].config.defaultModel).toBe(
      "openclaw",
    );
  });

  it("flips the primary model on a tier upgrade (haiku → sonnet)", async () => {
    // Existing config is on the free tier (haiku); regen with
    // premium should refresh the model. This is the user-visible
    // effect of the whole pipeline.
    const existingFree = serializeOpenClawConfig(
      generateOpenClawConfig("free"),
    );
    const workspaceConfigService = makeWorkspaceServiceStub({
      existingOpenClaw: existingFree,
    });
    const integrationService = { list: vi.fn().mockResolvedValue([]) };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-1",
      "premium",
    );

    const updates = workspaceConfigService.updateFiles.mock.calls[0]![1];
    const openClawUpdate = updates.find(
      (u: { filename: string }) => u.filename === "openclaw.json",
    );
    const written = JSON.parse(openClawUpdate!.content);
    expect(written.agents.defaults.model.primary).toBe("anthropic/sonnet");
  });

  it("preserves third-party plugin entries across regen", async () => {
    const existing = {
      plugins: {
        entries: {
          "axel-bridge": {
            enabled: true,
            config: {
              chatCompletionsBaseUrl: "http://127.0.0.1:18789",
              defaultModel: "openclaw",
            },
            path: "/opt/axel-bridge",
          },
          "third-party": {
            enabled: true,
            config: { somethingUserSet: true },
            path: "/opt/third-party",
          },
        },
      },
    };
    const workspaceConfigService = makeWorkspaceServiceStub({
      existingOpenClaw: JSON.stringify(existing),
    });
    const integrationService = { list: vi.fn().mockResolvedValue([]) };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-1",
      "free",
    );

    const updates = workspaceConfigService.updateFiles.mock.calls[0]![1];
    const openClawUpdate = updates.find(
      (u: { filename: string }) => u.filename === "openclaw.json",
    );
    const written = JSON.parse(openClawUpdate!.content);
    expect(written.plugins.entries["third-party"]).toEqual({
      enabled: true,
      config: { somethingUserSet: true },
      path: "/opt/third-party",
    });
  });

  it("skips openclaw.json regen (but still writes TOOLS.md) when the existing file is malformed", async () => {
    // Don't clobber evidence of corruption. The container's next
    // boot will rewrite from the template via the entrypoint
    // fallback; in the meantime TOOLS.md still goes through because
    // it's a fresh write, not a merge.
    const warn = vi.fn();
    const workspaceConfigService = makeWorkspaceServiceStub({
      existingOpenClaw: "{not json at all",
    });
    const integrationService = { list: vi.fn().mockResolvedValue([]) };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: { warn } },
      "u-1",
      "free",
    );

    expect(workspaceConfigService.updateFiles).toHaveBeenCalledOnce();
    const updates = workspaceConfigService.updateFiles.mock.calls[0]![1];
    const filenames = updates.map((u: { filename: string }) => u.filename);
    expect(filenames).toContain("TOOLS.md");
    expect(filenames).not.toContain("openclaw.json");
    expect(warn).toHaveBeenCalledWith(
      "openclaw.json malformed; skipping regen",
      expect.objectContaining({ userId: "u-1" }),
    );
  });

  it("defaults a null tier to 'free' across both files", async () => {
    const integrationService = { list: vi.fn().mockResolvedValue([]) };
    const workspaceConfigService = makeWorkspaceServiceStub();

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-2",
      null,
    );

    const updates = workspaceConfigService.updateFiles.mock.calls[0]![1];
    const toolsContent = updates.find(
      (u: { filename: string }) => u.filename === "TOOLS.md",
    )!.content;
    expect(toolsContent).toMatch(/free tier/);
    const openClawContent = updates.find(
      (u: { filename: string }) => u.filename === "openclaw.json",
    )!.content;
    const parsed = JSON.parse(openClawContent);
    expect(parsed.agents.defaults.model.primary).toBe("anthropic/haiku");
  });

  it("forwards a custom reason verbatim (e.g. 'byom_changed')", async () => {
    const integrationService = { list: vi.fn().mockResolvedValue([]) };
    const workspaceConfigService = makeWorkspaceServiceStub();

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService, logger: makeNoopLogger() },
      "u-3",
      "premium",
      { reason: "byom_changed" },
    );

    expect(workspaceConfigService.updateFiles.mock.calls[0]![2]).toBe(
      "byom_changed",
    );
  });

  it("propagates errors from updateFiles (so callers can decide how to surface)", async () => {
    const integrationService = { list: vi.fn().mockResolvedValue([]) };
    const workspaceConfigService = {
      updateFiles: vi.fn().mockRejectedValue(new Error("EFS write failed")),
      readWorkspaceFile: vi.fn().mockResolvedValue(null),
    };

    await expect(
      syncWorkspaceAfterIntegrationChange(
        {
          integrationService,
          workspaceConfigService,
          logger: makeNoopLogger(),
        },
        "u-4",
        "free",
      ),
    ).rejects.toThrow(/EFS write failed/);
  });
});
