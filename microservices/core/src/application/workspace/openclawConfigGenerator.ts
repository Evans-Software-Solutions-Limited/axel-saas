/**
 * `openclaw.json` generator — produces the workspace-level OpenClaw
 * config the gateway reads on boot (and re-reads on
 * `/api/reload`).
 *
 * Pure function. Takes a tier, returns the canonical config object
 * for that tier. Companion to `toolsGenerator.ts` (which does the
 * same for `TOOLS.md`); both feed into `integrationsSync.ts` which
 * writes them together via `WorkspaceConfigService.updateFiles`.
 *
 * ## Why this exists despite the on-disk templates
 *
 * `docker/openclaw/workspace-templates/openclaw-{tier}.json` are the
 * source files the **container entrypoint** copies into a user's
 * workspace on first boot. Post-onboarding, those files are stale —
 * the workspace volume's copy is the live config. The container
 * doesn't re-seed unless the file is missing.
 *
 * The **Lambda** can't reach `/data/workspace-templates/` (different
 * filesystem). For runtime regen, we need the same structure
 * available as a TS module. Drift between the two is caught by the
 * "matches on-disk template" test below — if the templates change,
 * CI fails until the generator catches up.
 *
 * ## What the generator owns vs. what gets preserved
 *
 * - `gateway.*` — platform infrastructure config. Regenerated.
 * - `agents.defaults.workspace` — fixed path on the container's EFS
 *   mount. Regenerated (but never changes per tier in practice).
 * - `agents.defaults.model.primary` — TIER-DEPENDENT. Regenerated
 *   from tier. This is the whole reason runtime regen exists —
 *   premium upgrades flip haiku → sonnet here.
 * - `plugins.entries.axel-bridge` — template-managed `enabled` +
 *   `config` keys regenerated; runtime-added keys (e.g. `path`,
 *   `version`) preserved by the merger. See `openclawConfigMerger.ts`.
 * - Anything else the user (or a future plugin install) writes —
 *   preserved by the merger.
 */

import type { SubscriptionTier } from "../integrations/tierGate";

/**
 * Structural shape of `openclaw.json`. Open-typed (`Record<string, unknown>`
 * fall-back on the leaf JSON value type) so the type doesn't need to
 * be updated every time OpenClaw upstream adds a new optional field.
 * The fields explicitly modelled below are the ones we *write* —
 * everything else flows through opaquely via the merger.
 */
export interface OpenClawConfig {
  gateway: {
    mode: string;
    bind: string;
    port: number;
    controlUi: {
      dangerouslyAllowHostHeaderOriginFallback: boolean;
    };
    http: {
      endpoints: {
        chatCompletions: { enabled: boolean };
      };
    };
  };
  agents: {
    defaults: {
      workspace: string;
      // Open-shaped so the merger can carry through user-set or
      // upstream-OpenClaw-added keys (`fallback`, `contextWindow`,
      // `temperature`, `providers`, …) alongside the regenerated
      // `primary`. Only `primary` is template-managed; everything
      // else flows through `mergeAgentsModel` untouched.
      model: { primary: string; [otherModelKey: string]: unknown };
      // Forward-compat: any other `agents.defaults.*` keys
      // (overrides, upstream additions) get carried through by the
      // merger.
      [otherDefaultsKey: string]: unknown;
    };
    // Forward-compat: `agents.*` siblings of `defaults`
    // (e.g. `agents.fleet`, `agents.policies`) flow through the
    // merger untouched.
    [otherAgentsKey: string]: unknown;
  };
  plugins: {
    entries: {
      "axel-bridge": OpenClawBridgePluginEntry;
      // Forward-compat: third-party plugin entries that the merger
      // preserves. Typed as `unknown` here because we don't read
      // them; the merger just carries them through.
      [otherPluginId: string]: unknown;
    };
  };
  // Forward-compat: top-level keys we don't model but the merger
  // preserves verbatim from the existing file.
  [otherTopLevelKey: string]: unknown;
}

/**
 * The template-managed shape of the axel-bridge plugin entry. The
 * runtime is free to add keys (e.g. `path`, `version`, `installedAt`)
 * that we don't model here — those flow through the merger
 * untouched.
 */
export interface OpenClawBridgePluginEntry {
  enabled: boolean;
  config: {
    chatCompletionsBaseUrl: string;
    defaultModel: string;
  };
  // Carries any runtime-added keys (e.g. `path` from
  // `openclaw plugins install --link`) through the merger.
  [otherKey: string]: unknown;
}

/** Workspace path on the container's EFS mount. Fixed by the entrypoint. */
const WORKSPACE_PATH = "/data/workspace";

/**
 * Map a tier to the primary model id used by `agents.defaults`.
 * Free → haiku (cost-sensitive); premium + enterprise → sonnet
 * (capability-sensitive). Mirrors the values in the on-disk
 * `openclaw-{tier}.json` templates exactly — the drift-detector
 * test enforces this.
 */
const PRIMARY_MODEL_BY_TIER: Record<SubscriptionTier, string> = {
  free: "anthropic/haiku",
  premium: "anthropic/sonnet",
  enterprise: "anthropic/sonnet",
};

/**
 * Generate the canonical openclaw.json for a tier. Byte-stable: the
 * same tier always produces the same object structure, so repeated
 * regens with no upstream change produce the same serialised file.
 *
 * The merger combines this with any existing on-disk state before
 * writing — see `mergeOpenClawConfig`.
 */
export function generateOpenClawConfig(tier: SubscriptionTier): OpenClawConfig {
  return {
    gateway: {
      mode: "local",
      bind: "lan",
      port: 18789,
      controlUi: {
        dangerouslyAllowHostHeaderOriginFallback: true,
      },
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
        },
      },
    },
    agents: {
      defaults: {
        workspace: WORKSPACE_PATH,
        model: { primary: PRIMARY_MODEL_BY_TIER[tier] },
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
        },
      },
    },
  };
}

/**
 * Canonical serialisation. Two-space indent + trailing newline matches
 * the on-disk templates. Sorting keys would be marginally cleaner but
 * would diverge from the templates — and we'd lose the
 * "regen produces a byte-identical file when nothing changed"
 * property. Leave key order alone.
 */
export function serializeOpenClawConfig(config: OpenClawConfig): string {
  return JSON.stringify(config, null, 2) + "\n";
}
