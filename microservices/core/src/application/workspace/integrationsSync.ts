/**
 * Cross-subsystem helper: regenerate workspace files (TOOLS.md and
 * openclaw.json) from the user's current integrations + tier and
 * ask the running container to reload.
 *
 * Lives here rather than in `integrationHandler.ts` so the
 * integration subsystem doesn't have to know about workspace files
 * or reload signalling, and so all four integration mutation points
 * (`/connect` direct, `/revoke`, OAuth callback, future flows) call
 * the same helper instead of inlining the regen pipeline.
 *
 * ## Two-file write, one reload
 *
 * Both files are passed to `WorkspaceConfigService.updateFiles` in a
 * single call. That matters: the service fires ONE reload signal per
 * call, not one per file. Two separate calls would race (the second
 * reload could land before the first one's file-write completed) and
 * waste a round-trip to the container.
 *
 * ## What changed in feat/openclaw-config-regen
 *
 * Before this PR the orchestrator only wrote TOOLS.md. The
 * openclaw.json regen was deferred from PR #100 specifically because
 * of the risk of clobbering the bridge plugin's runtime registry
 * entries (`plugins.entries.axel-bridge.path`, `version`, …) written
 * by `openclaw plugins install --link` at container start. The
 * merger (`openclawConfigMerger.ts`) is what makes the regen safe:
 * it preserves those runtime keys while refreshing the template-
 * managed `enabled` + `config` keys + the tier-dependent model.
 *
 * Pure orchestrator — no DB writes of its own. Throws iff the
 * underlying file write fails (matches `WorkspaceConfigService`'s
 * contract); reload-signal failures are logged and swallowed inside
 * the service.
 */

import type { IntegrationService } from "../integrations/integrationService";
import type { SubscriptionTier } from "../integrations/tierGate";
import { regenerateOpenClawJsonUpdate } from "./openclawJsonRegen";
import { generateToolsMarkdown } from "./toolsGenerator";
import type {
  FileUpdate,
  WorkspaceConfigService,
  UpdateReason,
} from "./workspaceConfigService";

export interface IntegrationsSyncDeps {
  integrationService: Pick<IntegrationService, "list">;
  workspaceConfigService: Pick<
    WorkspaceConfigService,
    "updateFiles" | "readWorkspaceFile"
  >;
  /**
   * Logger for orchestrator-level events the underlying service
   * doesn't see — currently just the "openclaw.json was malformed,
   * skipping regen" warning. **Required** so call sites can't
   * accidentally swallow operator signals: this used to be optional
   * with a noop default, which meant the malformed-file warning
   * silently dropped in production because the only production
   * caller (`integrationHandler`) didn't pass one. Caught by bugbot
   * on #104. Tests can pass `{ warn: vi.fn() }`.
   */
  logger: {
    warn: (message: string, ctx?: Record<string, unknown>) => void;
  };
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
 * Regenerate workspace files (TOOLS.md + openclaw.json) from the
 * user's current integrations + tier, write them atomically, and
 * trigger a single workspace reload.
 */
export async function syncWorkspaceAfterIntegrationChange(
  deps: IntegrationsSyncDeps,
  userId: string,
  tier: SubscriptionTier | null,
  options: SyncOptions = {},
): Promise<void> {
  const effectiveTier = tier ?? "free";

  // 1. TOOLS.md — purely a function of integrations + tier.
  const integrations = await deps.integrationService.list(userId);
  const toolsContent = generateToolsMarkdown({
    integrations,
    tier: effectiveTier,
  });
  const updates: FileUpdate[] = [
    { filename: "TOOLS.md", content: toolsContent },
  ];

  // 2. openclaw.json — read the existing on-disk config, merge with
  //    a tier-appropriate fresh template, write the result. Adding
  //    the openclaw.json update to the SAME `updateFiles` call as
  //    TOOLS.md means one EFS round-trip and one reload signal.
  //
  // The actual regen lives in `openclawJsonRegen.ts` (shared with
  // `tierChangeSync.ts`) so the malformed-file + read-error
  // behaviour stays in lock-step across both call sites.
  const openClawUpdate = await regenerateOpenClawJsonUpdate(
    deps,
    userId,
    effectiveTier,
  );
  if (openClawUpdate) {
    updates.push(openClawUpdate);
  }

  await deps.workspaceConfigService.updateFiles(
    userId,
    updates,
    options.reason ?? "integration_changed",
  );
}
