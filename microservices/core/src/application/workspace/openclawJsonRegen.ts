/**
 * Shared helper for regenerating the `openclaw.json` file update.
 *
 * Both `integrationsSync` (when integrations change) and
 * `tierChangeSync` (when Stripe webhook fires a tier transition)
 * need to refresh `openclaw.json` because its
 * `agents.defaults.model.primary` is tier-dependent (see
 * `openclawConfigGenerator.ts` header).
 *
 * The complexity lives in the merge with the on-disk file:
 *
 *   - We must preserve runtime-managed keys the bridge plugin writes
 *     at container boot (`plugins.entries.axel-bridge.path`, version,
 *     etc.) — these are populated by `openclaw plugins install
 *     --link` and are NOT in our template.
 *   - The existing file may be malformed (a transient partial write
 *     from a crashed container) — in which case we DO NOT clobber it.
 *     Operator may want to inspect; the next container boot rewrites
 *     via the template-copy fallback in the entrypoint.
 *   - The existing file may be missing entirely (first regen, before
 *     the container has booted) — that's the legitimate first-run
 *     case, not an error.
 *
 * Extracted from `integrationsSync.ts` so the same merge semantics
 * apply to tier changes without duplicating the read-parse-merge
 * machinery. Inspector PR #104 caught a "malformed file warning
 * silently dropped in production" regression on the original code
 * path; keeping the helper in one place means future fixes land
 * once.
 */

import type { SubscriptionTier } from "../integrations/tierGate";
import type {
  FileUpdate,
  WorkspaceConfigService,
} from "./workspaceConfigService";
import {
  generateOpenClawConfig,
  serializeOpenClawConfig,
} from "./openclawConfigGenerator";
import {
  mergeOpenClawConfig,
  parseExistingOpenClawConfig,
} from "./openclawConfigMerger";

export interface OpenclawJsonRegenDeps {
  workspaceConfigService: Pick<WorkspaceConfigService, "readWorkspaceFile">;
  /**
   * Required logger. Same pattern as `IntegrationsSyncDeps.logger` —
   * making the operator-visible "malformed file" / "read failed"
   * warnings opt-in by accident was the bugbot finding on PR #104.
   */
  logger: { warn: (message: string, ctx?: Record<string, unknown>) => void };
}

/**
 * Produce the `openclaw.json` `FileUpdate`, or `null` when the
 * existing file is malformed and we'd rather skip the regen than
 * clobber the evidence of corruption.
 *
 * Returns `null` in two cases — both intentionally non-fatal so the
 * caller's other file writes (TOOLS.md, SOUL.md, AGENTS.md) still go
 * through with a single reload:
 *
 *   - Read errored (EACCES, EIO, EBUSY — anything except ENOENT,
 *     which the default fs.readFile converts to null). Inspector
 *     PR #104 caught the regression where non-ENOENT errors
 *     short-circuited the whole sync.
 *   - On-disk file was malformed JSON. Don't clobber the evidence;
 *     the entrypoint's template-copy fallback rewrites it on the
 *     next container boot.
 */
export async function regenerateOpenClawJsonUpdate(
  deps: OpenclawJsonRegenDeps,
  userId: string,
  tier: SubscriptionTier,
): Promise<FileUpdate | null> {
  const { logger } = deps;

  let existingRaw: string | null;
  try {
    existingRaw = await deps.workspaceConfigService.readWorkspaceFile(
      userId,
      "openclaw.json",
    );
  } catch (err: unknown) {
    logger.warn("openclaw.json read failed; skipping regen", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const parsed = parseExistingOpenClawConfig(existingRaw);
  if (parsed.kind === "malformed") {
    logger.warn("openclaw.json malformed; skipping regen", {
      userId,
      error: parsed.error,
    });
    return null;
  }

  const generated = generateOpenClawConfig(tier);
  const existing = parsed.kind === "ok" ? parsed.value : null;
  const merged = mergeOpenClawConfig(existing, generated);

  return {
    filename: "openclaw.json",
    content: serializeOpenClawConfig(merged),
  };
}
