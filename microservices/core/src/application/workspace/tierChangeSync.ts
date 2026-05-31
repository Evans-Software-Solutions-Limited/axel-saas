/**
 * Cross-subsystem helper: regenerate workspace files after a Stripe
 * tier-change event lands. Refreshes every file that is
 * tier-dependent so a running container picks up the new tier on its
 * next reload, rather than waiting for the user to re-onboard.
 *
 * Spec reference: the "Stubbed / missing for go-live" list in the
 * production-readiness snapshot — "Stripe tier-change → workspace
 * regen" was the second-biggest user-visible MVP gap after the chat
 * loop closing.
 *
 * ## What's regenerated
 *
 *   - `SOUL.md`   — tier-dependent (Free / Premium / Enterprise
 *                   directives differ in the template). Requires
 *                   onboarding answers for personalisation; skipped
 *                   if the user hasn't completed onboarding yet
 *                   (they'll get the new SOUL on next completion).
 *   - `AGENTS.md` — tier-only. Always regenerated.
 *   - `openclaw.json` — tier-dependent via `agents.defaults.model
 *                   .primary` (see openclawConfigGenerator header).
 *                   Merged with on-disk state to preserve runtime
 *                   plugin registry keys.
 *   - `TOOLS.md`  — tier-dependent via the BYOM gate (Premium+ users
 *                   with openai/anthropic connected get those tools
 *                   exposed; Free users don't). Regenerated using
 *                   the user's current integrations list.
 *
 * USER.md and MEMORY.md are NOT regenerated — they're snapshots of
 * onboarding answers + user-edited memory and the tier doesn't enter
 * either generator. Regenerating them on tier change would clobber
 * any user edits to MEMORY.md.
 *
 * ## Failure mode
 *
 * One `updateFiles` call → one reload signal. If the user has no
 * provisioned container yet (`provisioningRepo` returns nothing),
 * `WorkspaceConfigService.updateFiles` still writes to EFS — the
 * next container boot picks up the fresh files. The reload's HTTP
 * call to a non-existent container fails inside the service's
 * detached `signalReload`; logged-not-thrown so a Stripe webhook
 * tier change for an un-provisioned user still succeeds.
 *
 * Pure orchestrator — no DB writes of its own. Throws iff the
 * underlying file write fails (matches `WorkspaceConfigService`'s
 * contract); reload-signal failures are logged and swallowed inside
 * the service. Callers (Stripe webhook) should NOT let a throw here
 * fail the whole webhook event — a partial workspace regen is bad
 * but a Stripe retry storm is worse. See the call site in
 * `stripeHandler.ts` for the wrapped-try discussion.
 */

import type { IntegrationService } from "../integrations/integrationService";
import type { SubscriptionTier } from "../integrations/tierGate";
import type { UserRepository } from "../repositories/userRepository";
import { regenerateOpenClawJsonUpdate } from "./openclawJsonRegen";
import { generateToolsMarkdown } from "./toolsGenerator";
import {
  generateAgentsContent,
  generateSoulContent,
  type OnboardingAnswers,
} from "./workspaceGenerator";
import type {
  FileUpdate,
  WorkspaceConfigService,
} from "./workspaceConfigService";

export interface TierChangeSyncDeps {
  userRepository: Pick<UserRepository, "getOnboardingAnswers">;
  integrationService: Pick<IntegrationService, "list">;
  workspaceConfigService: Pick<
    WorkspaceConfigService,
    "updateFiles" | "readWorkspaceFile"
  >;
  /**
   * Required logger. Used for:
   *   - "skipping SOUL.md regen — no onboarding answers" (info)
   *   - "openclaw.json malformed; skipping regen" (warn, from the
   *     shared regen helper)
   *
   * Same opinionated-required-logger pattern as `integrationsSync`
   * — optional-with-noop-default was the bugbot finding on PR #104
   * that silently dropped operator signals in production.
   */
  logger: {
    info: (message: string, ctx?: Record<string, unknown>) => void;
    warn: (message: string, ctx?: Record<string, unknown>) => void;
  };
}

/**
 * Regenerate every tier-sensitive workspace file from the user's
 * current state + the new tier, write them in a single
 * `updateFiles` call (one reload signal), and return when the EFS
 * write completes.
 *
 * Idempotent — calling twice with the same tier produces the same
 * files. Safe to invoke from a Stripe webhook handler that may
 * retry.
 */
export async function syncWorkspaceAfterTierChange(
  deps: TierChangeSyncDeps,
  userId: string,
  newTier: SubscriptionTier,
): Promise<void> {
  const { logger } = deps;
  const updates: FileUpdate[] = [];

  // 1. AGENTS.md — tier-only. Always regenerate.
  updates.push({
    filename: "AGENTS.md",
    content: generateAgentsContent(newTier),
  });

  // 2. SOUL.md — needs onboarding answers for personalisation.
  // Skip the SOUL update if the user hasn't completed onboarding;
  // the onboarding handler writes a fresh SOUL.md on /complete, so
  // a user mid-onboarding will get the right tier-aware SOUL when
  // they finish. Regenerating with empty answers here would
  // overwrite any in-progress workspace state with a malformed
  // skeleton.
  const onboardingAnswers =
    await deps.userRepository.getOnboardingAnswers(userId);
  if (onboardingAnswers) {
    updates.push({
      filename: "SOUL.md",
      content: generateSoulContent(
        onboardingAnswers as OnboardingAnswers,
        newTier,
      ),
    });
  } else {
    logger.info(
      "tier-change-sync: skipping SOUL.md regen (no onboarding answers)",
      { userId, newTier },
    );
  }

  // 3. TOOLS.md — derives from integrations + tier (the tier gate
  // is what unlocks BYOM exposure of openai/anthropic). Always
  // regenerate; an empty integrations list is the legitimate
  // first-tier-change case and the generator handles it.
  const integrations = await deps.integrationService.list(userId);
  updates.push({
    filename: "TOOLS.md",
    content: generateToolsMarkdown({
      integrations,
      tier: newTier,
    }),
  });

  // 4. openclaw.json — shared regen with integrationsSync. Tier
  // changes the `agents.defaults.model.primary` value, so the
  // merge with the on-disk file MUST run; without it, a
  // tier-changed user's next chat would still use the OLD tier's
  // model.
  const openClawUpdate = await regenerateOpenClawJsonUpdate(
    deps,
    userId,
    newTier,
  );
  if (openClawUpdate) {
    updates.push(openClawUpdate);
  }

  // Single updateFiles call → single reload signal. Per spec, the
  // reload runs detached inside the service so this returns as soon
  // as the EFS write completes. Reason is "tier_changed" — already
  // in the UpdateReason union, just nobody was emitting it yet.
  await deps.workspaceConfigService.updateFiles(
    userId,
    updates,
    "tier_changed",
  );
}
