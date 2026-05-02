/**
 * Static catalog of integrations Axel supports today. Keep in sync with
 * the backend's VALID_INTEGRATIONS list (microservices/core/src/application/
 * integrations/integrationService.ts) — anything here that's not in that
 * list will fail tier gating + connect calls.
 *
 * Tier gating is enforced server-side; the `tierRequired` field here only
 * drives UI affordances (lock icon, disabled CTA).
 */

import {
  IconBrandGithub,
  IconBrandGoogle,
  IconBrandSlack,
  IconBrandOpenai,
  IconBrandTelegram,
  IconMicrophone,
  IconRobot,
  type Icon,
} from "@tabler/icons-react";

export type CatalogCategory = "communication" | "tools" | "ai-models";
export type AuthType = "api-key" | "oauth";
export type CatalogTier = "free" | "premium";

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  category: CatalogCategory;
  authType: AuthType;
  tierRequired: CatalogTier;
  icon: Icon;
  iconColor: string;
  iconBg: string;
  helpText: string;
  helpUrl?: string;
  /** Placeholder text for the credential input field. */
  credentialPlaceholder: string;
  /** Human label for the credential field. */
  credentialLabel: string;
}

export const INTEGRATIONS_CATALOG: readonly CatalogEntry[] = [
  // ── Communication ────────────────────────────────────────────────
  {
    id: "telegram-bot",
    name: "Telegram",
    description: "Talk to Axel in Telegram chats via your own bot.",
    category: "communication",
    authType: "api-key",
    tierRequired: "free",
    icon: IconBrandTelegram,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-400/10",
    helpText:
      "Create a bot with @BotFather on Telegram and paste the token below.",
    helpUrl: "https://core.telegram.org/bots/tutorial",
    credentialPlaceholder: "123456:ABC-DEF...",
    credentialLabel: "Bot token",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Mention Axel in your Slack workspace channels and DMs.",
    category: "communication",
    authType: "oauth",
    tierRequired: "free",
    icon: IconBrandSlack,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
    helpText: "Click Connect to install the Axel Slack app on your workspace.",
    credentialPlaceholder: "",
    credentialLabel: "",
  },
  {
    id: "google",
    name: "Google",
    description: "Gmail, Calendar and Drive in one connection.",
    category: "communication",
    authType: "oauth",
    tierRequired: "free",
    icon: IconBrandGoogle,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10",
    helpText:
      "Sign in with Google to grant Axel access to Gmail, Calendar and Drive.",
    credentialPlaceholder: "",
    credentialLabel: "",
  },
  // ── Tools ────────────────────────────────────────────────────────
  {
    id: "github",
    name: "GitHub",
    description: "Read and create issues, PRs and code on your repos.",
    category: "tools",
    authType: "api-key",
    tierRequired: "free",
    icon: IconBrandGithub,
    iconColor: "text-text",
    iconBg: "bg-white/[0.04]",
    helpText:
      "Create a personal access token with repo + issues scope and paste it below.",
    helpUrl:
      "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
    credentialPlaceholder: "ghp_...",
    credentialLabel: "Personal access token",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Voice synthesis for spoken responses and audio messages.",
    category: "tools",
    authType: "api-key",
    tierRequired: "free",
    icon: IconMicrophone,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    helpText:
      "Get an API key from your ElevenLabs profile — Settings → API Keys.",
    helpUrl: "https://elevenlabs.io/docs/api-reference/authentication",
    credentialPlaceholder: "xi-...",
    credentialLabel: "API key",
  },
  // ── AI models (BYOM, Premium) ────────────────────────────────────
  {
    id: "openai",
    name: "OpenAI",
    description: "Bring your own OpenAI key — Axel uses your account quota.",
    category: "ai-models",
    authType: "api-key",
    tierRequired: "premium",
    icon: IconBrandOpenai,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    helpText: "Create a key at platform.openai.com under API keys.",
    helpUrl: "https://platform.openai.com/api-keys",
    credentialPlaceholder: "sk-...",
    credentialLabel: "API key",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Bring your own Anthropic key for Claude-powered responses.",
    category: "ai-models",
    authType: "api-key",
    tierRequired: "premium",
    icon: IconRobot,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10",
    helpText: "Create a key at console.anthropic.com under API keys.",
    helpUrl: "https://console.anthropic.com/settings/keys",
    credentialPlaceholder: "sk-ant-...",
    credentialLabel: "API key",
  },
];

export function getCatalogEntry(id: string): CatalogEntry | undefined {
  return INTEGRATIONS_CATALOG.find((entry) => entry.id === id);
}

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  communication: "Communication",
  tools: "Tools",
  "ai-models": "AI Models",
};

export const CATEGORY_ORDER: readonly CatalogCategory[] = [
  "communication",
  "tools",
  "ai-models",
];
