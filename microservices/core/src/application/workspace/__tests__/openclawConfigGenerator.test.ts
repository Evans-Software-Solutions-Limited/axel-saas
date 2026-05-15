/**
 * Tests for the openclaw.json generator. Two threads of assertions:
 *
 *   1. **Functional** — the generated structure has the right
 *      tier-dependent model, the bridge plugin block is present,
 *      gateway config matches what the OpenClaw runtime expects.
 *   2. **Drift detector** — the generated output, when serialised,
 *      is byte-identical to the corresponding on-disk
 *      `docker/openclaw/workspace-templates/openclaw-{tier}.json`
 *      that the container entrypoint copies into a fresh workspace.
 *
 * The drift detector is load-bearing: if a template changes and the
 * generator doesn't (or vice versa), a first-boot container would
 * write a different file than runtime regen would produce, so the
 * very first `WorkspaceConfigService.regenerateOpenClawJson` call
 * would churn the workspace volume with no functional change. The
 * test fails before that ships.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  generateOpenClawConfig,
  serializeOpenClawConfig,
} from "../openclawConfigGenerator";
import type { SubscriptionTier } from "../../integrations/tierGate";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// __tests__ → workspace → application → src → core → microservices → REPO ROOT
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..", "..");
const TEMPLATES_DIR = path.join(
  REPO_ROOT,
  "docker",
  "openclaw",
  "workspace-templates",
);

const TIERS: readonly SubscriptionTier[] = ["free", "premium", "enterprise"];

describe("generateOpenClawConfig", () => {
  it.each(TIERS)(
    "always produces the bridge-plugin block for %s tier",
    (tier) => {
      const config = generateOpenClawConfig(tier);
      expect(config.plugins.entries["axel-bridge"]).toBeDefined();
      expect(config.plugins.entries["axel-bridge"]?.enabled).toBe(true);
      expect(config.plugins.entries["axel-bridge"]?.config.defaultModel).toBe(
        "openclaw",
      );
    },
  );

  it.each([
    ["free", "anthropic/haiku"],
    ["premium", "anthropic/sonnet"],
    ["enterprise", "anthropic/sonnet"],
  ] as const)(
    "maps %s tier to %s as the primary model",
    (tier, expectedModel) => {
      const config = generateOpenClawConfig(tier);
      expect(config.agents.defaults.model.primary).toBe(expectedModel);
    },
  );

  it("uses the fixed /data/workspace EFS path (matches the container entrypoint)", () => {
    for (const tier of TIERS) {
      expect(generateOpenClawConfig(tier).agents.defaults.workspace).toBe(
        "/data/workspace",
      );
    }
  });

  it("is byte-stable across repeated calls (deterministic)", () => {
    // Critical for the regen-doesn't-churn-the-workspace property —
    // calling regen N times with the same tier must produce a single
    // identical file. If we ever introduce nondeterminism (e.g. a
    // timestamp) this test catches it.
    for (const tier of TIERS) {
      const a = serializeOpenClawConfig(generateOpenClawConfig(tier));
      const b = serializeOpenClawConfig(generateOpenClawConfig(tier));
      expect(a).toBe(b);
    }
  });
});

describe("serializeOpenClawConfig (drift detector)", () => {
  it.each(TIERS)(
    "matches the on-disk openclaw-%s.json template byte-for-byte",
    async (tier) => {
      // If this fails: either the template was hand-edited (update
      // the generator to match) or the generator changed (update the
      // template to match). Both must move together — first-boot
      // seeding and runtime regen produce the same file, by
      // construction.
      const templatePath = path.join(TEMPLATES_DIR, `openclaw-${tier}.json`);
      const onDisk = await fs.readFile(templatePath, "utf8");
      const generated = serializeOpenClawConfig(generateOpenClawConfig(tier));
      expect(generated).toBe(onDisk);
    },
  );
});
