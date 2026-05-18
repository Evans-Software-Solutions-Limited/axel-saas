/**
 * Tests for the openclaw.json merger. The merger is the heart of the
 * "regen doesn't clobber the bridge plugin" guarantee — the test
 * suite is structured around the failure modes that motivated this
 * PR existing at all (the silent-failure class hit during PR #99 +
 * the deferral note in PR #100's description).
 */
import { describe, expect, it } from "vitest";
import { generateOpenClawConfig } from "../openclawConfigGenerator";
import {
  mergeOpenClawConfig,
  parseExistingOpenClawConfig,
} from "../openclawConfigMerger";

const generatedFree = generateOpenClawConfig("free");
const generatedPremium = generateOpenClawConfig("premium");

describe("parseExistingOpenClawConfig", () => {
  it("returns missing for null / undefined / empty / whitespace input", () => {
    expect(parseExistingOpenClawConfig(null)).toEqual({ kind: "missing" });
    expect(parseExistingOpenClawConfig(undefined)).toEqual({ kind: "missing" });
    expect(parseExistingOpenClawConfig("")).toEqual({ kind: "missing" });
    expect(parseExistingOpenClawConfig("   \n  \t ")).toEqual({
      kind: "missing",
    });
  });

  it("returns ok with the parsed object on valid JSON", () => {
    const result = parseExistingOpenClawConfig('{"foo": "bar"}');
    expect(result).toEqual({ kind: "ok", value: { foo: "bar" } });
  });

  it("returns malformed on invalid JSON", () => {
    const result = parseExistingOpenClawConfig("{nope");
    expect(result.kind).toBe("malformed");
    if (result.kind === "malformed") {
      expect(result.error).toMatch(/JSON|Unexpected|token/i);
    }
  });

  it("rejects non-object roots (arrays, primitives) as malformed", () => {
    expect(parseExistingOpenClawConfig("[1, 2, 3]").kind).toBe("malformed");
    expect(parseExistingOpenClawConfig('"a string"').kind).toBe("malformed");
    expect(parseExistingOpenClawConfig("null").kind).toBe("malformed");
    expect(parseExistingOpenClawConfig("42").kind).toBe("malformed");
  });
});

describe("mergeOpenClawConfig", () => {
  it("returns generated as-is when existing is null (first regen)", () => {
    expect(mergeOpenClawConfig(null, generatedFree)).toEqual(generatedFree);
  });

  it("returns generated as-is when existing is undefined", () => {
    expect(mergeOpenClawConfig(undefined, generatedFree)).toEqual(
      generatedFree,
    );
  });

  it("refreshes the primary model on a tier upgrade (haiku → sonnet)", () => {
    // Simulate an existing free-tier config; regen with premium
    // template. The model should flip — that's the whole point of
    // regen.
    const existing = generatedFree as unknown as Record<string, unknown>;
    const merged = mergeOpenClawConfig(existing, generatedPremium);
    expect(merged.agents.defaults.model.primary).toBe("anthropic/sonnet");
  });

  it("preserves runtime-added keys on the axel-bridge entry (the PR #99 failure-class defence)", () => {
    // `openclaw plugins install --link` adds runtime registry keys at
    // the top of the bridge plugin block. The merger MUST carry those
    // through — losing them is the exact failure that caused the
    // "7 plugins: … (no axel-bridge)" silent failure in PR #99
    // debugging, just via a different mechanism.
    const existing: Record<string, unknown> = {
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
            installedAt: "2026-05-09T12:00:00Z",
          },
        },
      },
    };

    const merged = mergeOpenClawConfig(existing, generatedFree);
    const bridge = merged.plugins.entries["axel-bridge"]!;
    expect(bridge.path).toBe("/opt/axel-bridge");
    expect(bridge.version).toBe("0.0.0");
    expect(bridge.installedAt).toBe("2026-05-09T12:00:00Z");
    // Template-managed keys still refreshed.
    expect(bridge.enabled).toBe(true);
    expect(bridge.config.chatCompletionsBaseUrl).toBe("http://127.0.0.1:18789");
  });

  it("refreshes axel-bridge config.* even if the existing values diverged", () => {
    // If a previous version of the template wrote a different
    // defaultModel, the regen MUST overwrite it. The template owns
    // this block.
    const existing: Record<string, unknown> = {
      plugins: {
        entries: {
          "axel-bridge": {
            enabled: false, // existing diverged from template
            config: {
              chatCompletionsBaseUrl: "http://wrong.example",
              defaultModel: "openclaw/wrong",
            },
            path: "/opt/axel-bridge",
          },
        },
      },
    };

    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.plugins.entries["axel-bridge"]?.enabled).toBe(true);
    expect(
      merged.plugins.entries["axel-bridge"]?.config.chatCompletionsBaseUrl,
    ).toBe("http://127.0.0.1:18789");
    expect(merged.plugins.entries["axel-bridge"]?.config.defaultModel).toBe(
      "openclaw",
    );
    // Runtime key still preserved.
    expect(merged.plugins.entries["axel-bridge"]?.path).toBe(
      "/opt/axel-bridge",
    );
  });

  it("preserves third-party plugin entries entirely (forward-compat)", () => {
    // The future scenario: user (or upstream) installs another
    // OpenClaw plugin. The merger must NOT touch it.
    const existing: Record<string, unknown> = {
      plugins: {
        entries: {
          "axel-bridge": {
            enabled: true,
            config: {},
            path: "/opt/axel-bridge",
          },
          "third-party-plugin": {
            enabled: true,
            config: { something: "user-set" },
            path: "/opt/third-party",
            version: "1.2.3",
          },
        },
      },
    };

    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.plugins.entries["third-party-plugin"]).toEqual({
      enabled: true,
      config: { something: "user-set" },
      path: "/opt/third-party",
      version: "1.2.3",
    });
  });

  it("preserves unknown top-level keys from the existing file", () => {
    // Upstream OpenClaw might add a `telemetry`, `experimental`,
    // `featureFlags` block we don't model yet. The merger carries
    // them through.
    const existing: Record<string, unknown> = {
      telemetry: { enabled: true, endpoint: "https://example" },
      experimental: { someFlag: 42 },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.telemetry).toEqual({
      enabled: true,
      endpoint: "https://example",
    });
    expect(merged.experimental).toEqual({ someFlag: 42 });
  });

  it("preserves unknown sibling keys inside agents.defaults", () => {
    const existing: Record<string, unknown> = {
      agents: {
        defaults: {
          workspace: "/data/workspace",
          model: { primary: "anthropic/haiku" },
          someOverride: "user-set",
        },
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(
      (merged.agents.defaults as Record<string, unknown>)["someOverride"],
    ).toBe("user-set");
  });

  it("preserves sibling keys of agents.defaults (bugbot #104 — forward-compat for agents.fleet / agents.policies / agents.providers)", () => {
    // Without this preservation rule, any future upstream OpenClaw
    // additions (or user-managed `agents.fleet` etc.) get wiped on
    // every regen — silently — because the merger only knew about
    // `agents.defaults`. Mirrors `passThroughTopLevelKeys`'s
    // forward-compat story.
    const existing: Record<string, unknown> = {
      agents: {
        defaults: {
          workspace: "/data/workspace",
          model: { primary: "anthropic/haiku" },
        },
        fleet: { workers: 4 },
        policies: { retry: { maxAttempts: 3 } },
        providers: ["anthropic", "openai"],
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    const agents = merged.agents as Record<string, unknown>;
    expect(agents["fleet"]).toEqual({ workers: 4 });
    expect(agents["policies"]).toEqual({ retry: { maxAttempts: 3 } });
    expect(agents["providers"]).toEqual(["anthropic", "openai"]);
    // `defaults` still refreshed from the generator.
    expect(merged.agents.defaults.model.primary).toBe("anthropic/haiku");
  });

  it("preserves siblings of agents.defaults.model.primary (bugbot #104 round 2 — fallback / contextWindow / temperature stay)", () => {
    // The previous round of sibling-preservation fixed `agents.*` and
    // `agents.defaults.*` siblings but stopped one level too shallow:
    // the whole `model` object was being replaced, so `model.fallback`,
    // `model.contextWindow`, `model.temperature`, `model.providers` all
    // walked out the back door on every regen. Contract per the
    // generator + the merger file header: ONLY `primary` is template-
    // managed; every other key in `model` is preserved.
    const existing: Record<string, unknown> = {
      agents: {
        defaults: {
          workspace: "/data/workspace",
          model: {
            primary: "anthropic/haiku",
            fallback: "anthropic/sonnet",
            contextWindow: 200_000,
            temperature: 0.7,
            providers: ["anthropic", "openai"],
          },
        },
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedPremium);
    const model = merged.agents.defaults.model as Record<string, unknown>;
    // `primary` is regenerated (haiku → sonnet on a premium upgrade).
    expect(model["primary"]).toBe("anthropic/sonnet");
    // Every other model.* key is preserved.
    expect(model["fallback"]).toBe("anthropic/sonnet");
    expect(model["contextWindow"]).toBe(200_000);
    expect(model["temperature"]).toBe(0.7);
    expect(model["providers"]).toEqual(["anthropic", "openai"]);
  });

  it("falls back to the generated model when existing model is malformed", () => {
    // Defensive: if `model` is the wrong shape we don't want to
    // throw or carry a broken value through; reset to the generator.
    const existing: Record<string, unknown> = {
      agents: {
        defaults: {
          workspace: "/data/workspace",
          model: "not-an-object",
        },
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.agents.defaults.model).toEqual(
      generatedFree.agents.defaults.model,
    );
  });

  it("preserves agents.* siblings even when agents.defaults itself is malformed", () => {
    // Defensive: a malformed `defaults` doesn't justify wiping the
    // sibling keys (which might be the only valid data on disk).
    const existing: Record<string, unknown> = {
      agents: {
        defaults: "not-an-object",
        fleet: { workers: 8 },
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    const agents = merged.agents as Record<string, unknown>;
    expect(agents["fleet"]).toEqual({ workers: 8 });
    // defaults falls back to the generator's value.
    expect(merged.agents.defaults).toEqual(generatedFree.agents.defaults);
  });

  it("preserves sibling keys of plugins.entries (bugbot #104 — forward-compat for plugins.registry / plugins.featureFlags)", () => {
    // `openclaw plugins install --link` can write metadata under
    // `plugins.*` rather than only under `plugins.entries.<id>`;
    // future OpenClaw versions may add `plugins.registry`,
    // `plugins.featureFlags`, etc. The merger must preserve them
    // to match the forward-compat promise made by the file header.
    const existing: Record<string, unknown> = {
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
        },
        registry: {
          source: "npm",
          lastSyncedAt: "2026-05-10T00:00:00Z",
        },
        featureFlags: { experimentalLoader: true },
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    const plugins = merged.plugins as Record<string, unknown>;
    expect(plugins["registry"]).toEqual({
      source: "npm",
      lastSyncedAt: "2026-05-10T00:00:00Z",
    });
    expect(plugins["featureFlags"]).toEqual({ experimentalLoader: true });
    // axel-bridge still gets the merged treatment.
    expect(merged.plugins.entries["axel-bridge"]?.path).toBe(
      "/opt/axel-bridge",
    );
  });

  it("preserves plugins.* siblings even when plugins.entries itself is malformed", () => {
    const existing: Record<string, unknown> = {
      plugins: {
        entries: "not-an-object",
        registry: { source: "npm" },
      },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    const plugins = merged.plugins as Record<string, unknown>;
    expect(plugins["registry"]).toEqual({ source: "npm" });
    // entries falls back to the generator's value.
    expect(merged.plugins.entries).toEqual(generatedFree.plugins.entries);
  });

  it("treats a malformed agents block as missing and falls back to generated", () => {
    // Defensive: if the agents block is the wrong shape we don't
    // want to throw; we want a usable config out the other side.
    const existing: Record<string, unknown> = {
      agents: "not-an-object",
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.agents).toEqual(generatedFree.agents);
  });

  it("treats a malformed plugins.entries block as missing and falls back to generated", () => {
    const existing: Record<string, unknown> = {
      plugins: { entries: "not-an-object" },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.plugins).toEqual(generatedFree.plugins);
  });

  it("regenerates gateway entirely (existing gateway is never preserved)", () => {
    // Gateway is platform infrastructure — even if a previous
    // version had different values, we want regen to refresh.
    const existing: Record<string, unknown> = {
      gateway: { mode: "remote", port: 9999 },
    };
    const merged = mergeOpenClawConfig(existing, generatedFree);
    expect(merged.gateway).toEqual(generatedFree.gateway);
  });

  it("is byte-stable across repeated calls (deterministic output)", () => {
    // The merger feeding the writer must be deterministic — same
    // inputs always produce the same output object (and thus the
    // same serialised file). Otherwise repeated regens with no
    // upstream changes churn the file.
    const existing: Record<string, unknown> = {
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
        },
      },
    };
    const a = mergeOpenClawConfig(existing, generatedFree);
    const b = mergeOpenClawConfig(existing, generatedFree);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
