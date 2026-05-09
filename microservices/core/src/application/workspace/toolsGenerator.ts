/**
 * `TOOLS.md` generator — produces the markdown file the OpenClaw
 * agent reads to know what integrations the user has connected.
 *
 * Pure function. Takes a list of `IntegrationMetadata` rows (the
 * safe-metadata projection — never includes secret values) plus an
 * optional BYOM summary, returns the full markdown body.
 *
 * Replaces the static placeholder in `workspaceGenerator.ts`'s
 * `generateToolsContent()`. That function is still called once at
 * onboarding (no integrations connected yet); post-onboarding,
 * `WorkspaceConfigService` calls this generator with the live list.
 */

import type { IntegrationMetadata } from "../integrations/integrationRepository";
import { isValidIntegrationId } from "../integrations/integrationService";
import { isPremiumOnlyIntegration } from "../integrations/tierGate";

/**
 * Inputs for the generator. Keeps the function pure: callers fetch
 * the data, we just shape it.
 *
 * BYOM is intentionally not a separate parameter — `openai` and
 * `anthropic` integration ids ARE the BYOM model providers (per
 * `tierGate.ts` and `INTEGRATION_DISPLAY` below). When one of those
 * is connected, the generator surfaces it in the "AI Models" section
 * automatically. One source of truth, no shape duplication.
 */
export interface ToolsGeneratorInput {
  /** Full list of the user's integrations (any status). */
  integrations: readonly IntegrationMetadata[];
  /**
   * Subscription tier — surfaced in the file so the agent's view of
   * its own constraints stays consistent with the workspace.
   * Defaults to "free" if absent.
   */
  tier?: string;
}

/**
 * Per-integration display metadata. Centralised here so the generator
 * stays declarative and tests can iterate the table.
 *
 * The `category: "model"` integrations (`openai`, `anthropic`) are
 * the BYOM providers — they appear in the AI Models section, not
 * Channels or Integrations.
 */
const INTEGRATION_DISPLAY: Record<
  string,
  {
    name: string;
    category: "channel" | "tool" | "model";
    description: string;
  }
> = {
  openai: {
    name: "OpenAI",
    category: "model",
    description: "Bring your own OpenAI key",
  },
  anthropic: {
    name: "Anthropic",
    category: "model",
    description: "Bring your own Anthropic key",
  },
  elevenlabs: {
    name: "ElevenLabs",
    category: "tool",
    description: "Voice synthesis",
  },
  "telegram-bot": {
    name: "Telegram",
    category: "channel",
    description: "Bot token (incoming + outgoing messages)",
  },
  google: {
    name: "Google",
    category: "tool",
    description: "Calendar, Mail, Contacts (OAuth)",
  },
  slack: {
    name: "Slack",
    category: "channel",
    description: "Workspace channels + DMs (OAuth)",
  },
  github: {
    name: "GitHub",
    category: "tool",
    description: "Repos, issues, PRs (OAuth)",
  },
};

/**
 * Generate the TOOLS.md body. Stable output: the file is regenerated
 * idempotently — same inputs always produce byte-identical output.
 *
 * Sections:
 *   - Channels (connected only) — communication surfaces
 *   - Integrations (connected only) — tool integrations
 *   - AI Models — platform default OR connected BYOM provider(s)
 *   - Footer noting the file is generated and how to update it
 */
export function generateToolsMarkdown(input: ToolsGeneratorInput): string {
  const tier = input.tier ?? "free";
  const connected = input.integrations.filter(
    (i) => i.status === "connected" && isValidIntegrationId(i.integrationId),
  );

  const channels = bucketByCategory(connected, "channel");
  const tools = bucketByCategory(connected, "tool");
  const models = bucketByCategory(connected, "model");

  const sections: string[] = ["# TOOLS.md - Integrations & Tools", ""];

  sections.push("## Channels", "");
  if (channels.length === 0) {
    sections.push(
      "_No communication channels connected. WebChat is built-in._",
      "",
    );
  } else {
    for (const integration of channels) {
      sections.push(formatBullet(integration));
    }
    sections.push("");
  }

  sections.push("## Integrations", "");
  if (tools.length === 0) {
    sections.push("_No tool integrations connected._", "");
  } else {
    for (const integration of tools) {
      sections.push(formatBullet(integration));
    }
    sections.push("");
  }

  sections.push("## AI Models", "");
  if (models.length === 0) {
    sections.push(
      `- **Platform default** — provided by Axel (${tier} tier)`,
      "",
    );
  } else {
    for (const integration of models) {
      // Defensive: only render the byom hint when the row genuinely
      // came from a premium-only id. Belt + braces for the
      // "category: model" filter above.
      if (!isPremiumOnlyIntegration(integration.integrationId)) {
        continue;
      }
      const display = INTEGRATION_DISPLAY[integration.integrationId];
      const name = display?.name ?? integration.integrationId;
      const keyHintSuffix = integration.keyHint
        ? ` (key ending …${integration.keyHint})`
        : "";
      sections.push(`- **Bring your own model: ${name}**${keyHintSuffix}`);
    }
    sections.push("");
  }

  sections.push(
    "---",
    "",
    "_This file is generated. To update, change integrations or BYOM in your dashboard settings._",
    "",
  );

  return sections.join("\n");
}

function bucketByCategory(
  rows: readonly IntegrationMetadata[],
  category: "channel" | "tool" | "model",
): IntegrationMetadata[] {
  return rows
    .filter((i) => INTEGRATION_DISPLAY[i.integrationId]?.category === category)
    .sort(compareByDisplayName);
}

function formatBullet(integration: IntegrationMetadata): string {
  const display = INTEGRATION_DISPLAY[integration.integrationId];
  // Defensive: if integrationId is in the valid set but not in the
  // display table (table out of sync), fall back to the id string.
  const name = display?.name ?? integration.integrationId;
  const description =
    display?.description ?? "Connected (no description available)";
  const labelSuffix = integration.label ? ` [${integration.label}]` : "";
  return `- **${name}** — ${description}${labelSuffix}`;
}

function compareByDisplayName(
  a: IntegrationMetadata,
  b: IntegrationMetadata,
): number {
  const an = INTEGRATION_DISPLAY[a.integrationId]?.name ?? a.integrationId;
  const bn = INTEGRATION_DISPLAY[b.integrationId]?.name ?? b.integrationId;
  return an.localeCompare(bn);
}
