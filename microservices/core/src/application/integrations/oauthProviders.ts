/**
 * OAuth provider configuration for integrations that use redirect-based
 * authorization. Other integrations (telegram-bot, openai, anthropic, etc.)
 * use the API-key flow on POST /integrations/:id/connect and never reach
 * this module.
 *
 * Provider client_id / client_secret come from environment variables — the
 * Lambda binds them in infra/api.ts, defaulting to empty so the service
 * can return a structured "not configured" error instead of crashing.
 */

import type { IntegrationId } from "./integrationService";

export interface OauthProviderConfig {
  integrationId: IntegrationId;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
}

const PROVIDERS: Partial<Record<IntegrationId, OauthProviderConfig>> = {
  google: {
    integrationId: "google",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // Spec covers Gmail + Calendar + Drive under a single "google" connection.
    scopes: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/drive",
    ],
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
  },
  slack: {
    integrationId: "slack",
    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    // Bot scopes covering messaging + channel awareness; tighten per-skill
    // later once OpenClaw publishes the canonical scope list.
    scopes: ["chat:write", "channels:read", "im:write", "users:read"],
    clientIdEnv: "SLACK_OAUTH_CLIENT_ID",
    clientSecretEnv: "SLACK_OAUTH_CLIENT_SECRET",
  },
};

export function getOauthProvider(
  integrationId: string,
): OauthProviderConfig | null {
  return PROVIDERS[integrationId as IntegrationId] ?? null;
}

export function isOauthIntegration(integrationId: string): boolean {
  return getOauthProvider(integrationId) !== null;
}

export function listOauthIntegrationIds(): IntegrationId[] {
  return Object.keys(PROVIDERS) as IntegrationId[];
}
