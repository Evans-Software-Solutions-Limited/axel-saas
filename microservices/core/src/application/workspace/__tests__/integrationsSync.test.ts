/**
 * Tests for the integrations → workspace sync orchestrator.
 */
import { describe, expect, it, vi } from "vitest";
import { syncWorkspaceAfterIntegrationChange } from "../integrationsSync";
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

describe("syncWorkspaceAfterIntegrationChange", () => {
  it("regenerates TOOLS.md from the user's current integrations and forwards it to the workspace service", async () => {
    const integrationService = {
      list: vi.fn().mockResolvedValue(sampleConnected),
    };
    const workspaceConfigService = { updateFiles: vi.fn() };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService },
      "u-1",
      "premium",
    );

    expect(integrationService.list).toHaveBeenCalledWith("u-1");
    expect(workspaceConfigService.updateFiles).toHaveBeenCalledOnce();
    const [userId, updates, reason] =
      workspaceConfigService.updateFiles.mock.calls[0]!;
    expect(userId).toBe("u-1");
    expect(updates).toEqual([
      expect.objectContaining({
        filename: "TOOLS.md",
        content: expect.stringMatching(/Slack/),
      }),
    ]);
    expect(reason).toBe("integration_changed");
  });

  it("defaults a null tier to 'free' in the generated file", async () => {
    const integrationService = { list: vi.fn().mockResolvedValue([]) };
    const workspaceConfigService = { updateFiles: vi.fn() };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService },
      "u-2",
      null,
    );

    const generated =
      workspaceConfigService.updateFiles.mock.calls[0]![1][0]!.content;
    expect(generated).toMatch(/free tier/);
  });

  it("forwards a custom reason verbatim (e.g. 'byom_changed')", async () => {
    const integrationService = { list: vi.fn().mockResolvedValue([]) };
    const workspaceConfigService = { updateFiles: vi.fn() };

    await syncWorkspaceAfterIntegrationChange(
      { integrationService, workspaceConfigService },
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
    };

    await expect(
      syncWorkspaceAfterIntegrationChange(
        { integrationService, workspaceConfigService },
        "u-4",
        "free",
      ),
    ).rejects.toThrow(/EFS write failed/);
  });
});
