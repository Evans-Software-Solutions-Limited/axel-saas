/**
 * Cross-subsystem helper: regenerate workspace files (TOOLS.md) from
 * the user's current integrations + tier and ask the running
 * container to reload.
 *
 * Lives here rather than in `integrationHandler.ts` so the
 * integration subsystem doesn't have to know about workspace files
 * or reload signalling, and so all four integration mutation points
 * (`/connect` direct, `/revoke`, OAuth callback, future flows) call
 * the same helper instead of inlining the regen pipeline.
 *
 * Pure orchestrator — no DB writes of its own. Throws iff the
 * underlying file write fails (matches `WorkspaceConfigService`'s
 * contract); reload-signal failures are logged and swallowed inside
 * the service.
 */

import type { IntegrationService } from "../integrations/integrationService";
import type { SubscriptionTier } from "../integrations/tierGate";
import { generateToolsMarkdown } from "./toolsGenerator";
import type {
  WorkspaceConfigService,
  UpdateReason,
} from "./workspaceConfigService";

export interface IntegrationsSyncDeps {
  integrationService: Pick<IntegrationService, "list">;
  workspaceConfigService: Pick<WorkspaceConfigService, "updateFiles">;
}

export interface SyncOptions {
  /**
   * Reason code attached to the reload call. Defaults to
   * `"integration_changed"`. Callers can override e.g. to
   * `"byom_changed"` for openai/anthropic mutations — the file
   * content is the same either way (TOOLS.md derives BYOM from the
   * connected integrations list); the reason just makes the
   * downstream log narrative tighter.
   */
  reason?: UpdateReason;
}

/**
 * Regenerate TOOLS.md from the user's current integrations + tier
 * and trigger a workspace reload.
 */
export async function syncWorkspaceAfterIntegrationChange(
  deps: IntegrationsSyncDeps,
  userId: string,
  tier: SubscriptionTier | null,
  options: SyncOptions = {},
): Promise<void> {
  const integrations = await deps.integrationService.list(userId);
  const content = generateToolsMarkdown({
    integrations,
    tier: tier ?? "free",
  });
  await deps.workspaceConfigService.updateFiles(
    userId,
    [{ filename: "TOOLS.md", content }],
    options.reason ?? "integration_changed",
  );
}
