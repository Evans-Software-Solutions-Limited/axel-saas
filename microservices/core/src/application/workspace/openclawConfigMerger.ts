/**
 * `openclaw.json` merger — combines an on-disk config (what the
 * container's bridge-plugin install wrote at boot, plus anything else
 * upstream OpenClaw may have added) with a freshly-generated
 * tier-appropriate config (`generateOpenClawConfig`).
 *
 * Pure function. The orchestrator in `integrationsSync.ts` reads the
 * file, calls this, and writes the result.
 *
 * ## The merge rules in plain English
 *
 * We want to refresh tier-dependent and platform-managed config
 * (model id, gateway endpoints, axel-bridge enabled/config) while
 * preserving anything the runtime or the user has written that we
 * don't manage.
 *
 *   - **`gateway.*`** → generated wins entirely. Platform infrastructure.
 *   - **`agents.defaults.workspace`** → generated wins. Fixed EFS path.
 *   - **`agents.defaults.model.primary`** → generated wins. THIS is
 *     the value that flips haiku → sonnet on a premium upgrade; the
 *     whole point of runtime regen.
 *   - **`agents.defaults.*` (any other key)** → existing wins. Forward
 *     compat for any user-set or upstream-OpenClaw-added overrides.
 *   - **`plugins.entries.axel-bridge.enabled`** → generated wins.
 *   - **`plugins.entries.axel-bridge.config.*`** → generated wins.
 *     The template owns this block; the runtime doesn't write here.
 *   - **`plugins.entries.axel-bridge.<other-keys>`** → existing wins.
 *     `openclaw plugins install --link` adds runtime metadata at this
 *     level (e.g. `path: /opt/axel-bridge`, `version: ...`). Stomping
 *     those would unregister the plugin on the next boot, which is the
 *     exact silent-failure class PR #99 fixed by moving the install
 *     into the entrypoint. We DO NOT want to recreate that class via
 *     a careless regen.
 *   - **`plugins.entries.<other-plugin-id>`** → existing wins entirely.
 *     Forward compat for third-party plugins.
 *   - **Any other top-level key on the existing file** → preserved.
 *
 * ## Defensive behaviour
 *
 *   - **Existing is `null` or `undefined`** (e.g. first regen before
 *     the container has ever booted) → return generated as-is.
 *   - **Existing is malformed at any nested level** (e.g.
 *     `existing.plugins` is a string) → that level is discarded and
 *     the generated value takes its place. Better than throwing,
 *     because the caller can still write *something* valid; the file
 *     wasn't usable before regen anyway.
 *   - **JSON parse failure** is the caller's responsibility — they
 *     decide whether to skip the write (preserve evidence of
 *     corruption) or rewrite from the generated config (force-fix).
 *     `parseExistingOpenClawConfig` is a thin wrapper so the caller
 *     gets a discriminated result without each call site reinventing
 *     try/catch.
 */

import type {
  OpenClawBridgePluginEntry,
  OpenClawConfig,
} from "./openclawConfigGenerator";

export type ParseResult =
  | { kind: "ok"; value: Record<string, unknown> }
  | { kind: "missing" }
  | { kind: "malformed"; error: string };

/**
 * Parse the on-disk openclaw.json. Returns a discriminated union so
 * the caller can branch on missing vs. malformed without inventing
 * sentinels. Empty / whitespace-only files are treated as missing.
 */
export function parseExistingOpenClawConfig(
  raw: string | null | undefined,
): ParseResult {
  if (raw == null) return { kind: "missing" };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { kind: "missing" };
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!isPlainObject(parsed)) {
      return {
        kind: "malformed",
        error: "openclaw.json root must be a JSON object",
      };
    }
    return { kind: "ok", value: parsed };
  } catch (err: unknown) {
    return {
      kind: "malformed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Merge an existing openclaw.json (already JSON-parsed, the
 * `Record<string, unknown>` payload from `parseExistingOpenClawConfig`)
 * with a freshly-generated config. See the file header for rule
 * semantics.
 */
export function mergeOpenClawConfig(
  existing: Record<string, unknown> | null | undefined,
  generated: OpenClawConfig,
): OpenClawConfig {
  // No existing file (first regen for this user) → generated is the
  // whole answer. The bridge plugin's runtime keys haven't been
  // written yet; they will be on the next container boot.
  if (existing == null) return generated;

  const merged: OpenClawConfig = {
    ...passThroughTopLevelKeys(existing, generated),
    gateway: generated.gateway,
    agents: mergeAgents(existing.agents, generated.agents),
    plugins: mergePlugins(existing.plugins, generated.plugins),
  };

  return merged;
}

/**
 * Carry through any keys on `existing` that aren't in `managedKeys`
 * (the per-merge list of keys the caller owns and will overwrite).
 * Shared by every merge layer — top-level, agents, plugins — so the
 * forward-compat story is consistent: anything we don't manage, we
 * preserve. Asymmetry between the three layers was the cause of
 * #104's two low-severity findings.
 */
function passThroughSiblings(
  existing: Record<string, unknown>,
  managedKeys: readonly string[],
): Record<string, unknown> {
  const carry: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (managedKeys.includes(key)) continue;
    carry[key] = value;
  }
  return carry;
}

function passThroughTopLevelKeys(
  existing: Record<string, unknown>,
  generated: OpenClawConfig,
): OpenClawConfig {
  // `generated` provides the typed shape for the keys the merger
  // overwrites; the carry-through adds the unknown extras alongside.
  return {
    ...passThroughSiblings(existing, ["gateway", "agents", "plugins"]),
    gateway: generated.gateway,
    agents: generated.agents,
    plugins: generated.plugins,
  };
}

function mergeAgents(
  existingAgents: unknown,
  generatedAgents: OpenClawConfig["agents"],
): OpenClawConfig["agents"] {
  if (!isPlainObject(existingAgents)) return generatedAgents;

  // Preserve any sibling keys of `defaults` (e.g. `agents.fleet`,
  // `agents.policies`, `agents.providers` — anything upstream
  // OpenClaw adds before we've modelled it). We only own `defaults`.
  const agentsSiblings = passThroughSiblings(existingAgents, ["defaults"]);

  const existingDefaults = existingAgents["defaults"];
  if (!isPlainObject(existingDefaults)) {
    return {
      ...agentsSiblings,
      defaults: generatedAgents.defaults,
    } as OpenClawConfig["agents"];
  }

  // Generated wins for workspace + model.primary; existing carries
  // anything else inside `defaults` (overrides, upstream additions)
  // through.
  const defaultsSiblings = passThroughSiblings(existingDefaults, [
    "workspace",
    "model",
  ]);

  return {
    ...agentsSiblings,
    defaults: {
      ...defaultsSiblings,
      workspace: generatedAgents.defaults.workspace,
      model: mergeAgentsModel(
        existingDefaults["model"],
        generatedAgents.defaults.model,
      ),
    },
  } as OpenClawConfig["agents"];
}

/**
 * Merge the `agents.defaults.model` block. Only `primary` is
 * regenerated; every other key (`fallback`, `contextWindow`,
 * `temperature`, `providers`, anything upstream OpenClaw adds before
 * we've modelled it) is preserved from the existing file.
 *
 * This used to be a wholesale `model: generatedAgents.defaults.model`
 * replacement, which silently dropped sibling keys — caught by bugbot
 * after the previous round of sibling-preservation fixes; same
 * asymmetry one level deeper.
 */
function mergeAgentsModel(
  existingModel: unknown,
  generatedModel: OpenClawConfig["agents"]["defaults"]["model"],
): OpenClawConfig["agents"]["defaults"]["model"] {
  if (!isPlainObject(existingModel)) return generatedModel;
  return {
    ...passThroughSiblings(existingModel, ["primary"]),
    primary: generatedModel.primary,
  } as OpenClawConfig["agents"]["defaults"]["model"];
}

function mergePlugins(
  existingPlugins: unknown,
  generatedPlugins: OpenClawConfig["plugins"],
): OpenClawConfig["plugins"] {
  if (!isPlainObject(existingPlugins)) return generatedPlugins;

  // Preserve any sibling keys of `entries` (e.g. `plugins.registry`,
  // `plugins.featureFlags` — anything `openclaw plugins install`
  // might write at `plugins.*` rather than inside `plugins.entries`).
  // Without this, regen silently drops them — the asymmetry bugbot
  // flagged on #104.
  const pluginsSiblings = passThroughSiblings(existingPlugins, ["entries"]);

  const existingEntries = existingPlugins["entries"];
  if (!isPlainObject(existingEntries)) {
    return {
      ...pluginsSiblings,
      entries: generatedPlugins.entries,
    } as OpenClawConfig["plugins"];
  }

  // Start from existing entries (preserves third-party plugins),
  // then overlay the merged axel-bridge entry. Object spread keeps
  // existing keys in their original order followed by the
  // axel-bridge overlay; output stays deterministic across runs.
  const mergedEntries: Record<string, unknown> = { ...existingEntries };
  mergedEntries["axel-bridge"] = mergeBridgePluginEntry(
    existingEntries["axel-bridge"],
    generatedPlugins.entries["axel-bridge"],
  );

  return {
    ...pluginsSiblings,
    entries: mergedEntries as OpenClawConfig["plugins"]["entries"],
  } as OpenClawConfig["plugins"];
}

/**
 * Bridge-plugin block: generated wins for `enabled` and `config.*`;
 * existing wins for any sibling keys at the top of the bridge entry
 * (where `openclaw plugins install --link` writes its runtime
 * registry metadata). This is the rule that defends against the
 * silent-failure class PR #99 fixed.
 */
function mergeBridgePluginEntry(
  existingEntry: unknown,
  generatedEntry: OpenClawBridgePluginEntry,
): OpenClawBridgePluginEntry {
  if (!isPlainObject(existingEntry)) return generatedEntry;

  // Carry every existing key into the result, then overlay
  // template-managed keys last so they win. `config` is template-
  // managed AS A WHOLE — we don't try to deep-merge inside `config`
  // because the runtime doesn't write there (the template owns the
  // chatCompletionsBaseUrl / defaultModel fields, full stop).
  const carry: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existingEntry)) {
    if (key === "enabled" || key === "config") continue;
    carry[key] = value;
  }

  return {
    ...carry,
    enabled: generatedEntry.enabled,
    config: generatedEntry.config,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
