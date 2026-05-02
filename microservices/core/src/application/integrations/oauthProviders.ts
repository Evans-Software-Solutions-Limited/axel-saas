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
  /**
   * Provider-specific extra params merged into the authorization URL on
   * top of the standard `client_id`, `redirect_uri`, `response_type`,
   * `scope`, and `state`. Google needs `access_type=offline` +
   * `prompt=consent` to receive a refresh token; other providers don't
   * recognise those keys, so they live per-provider rather than being
   * universally applied.
   */
  authorizationExtras?: Record<string, string>;
  /**
   * Some providers (notably Slack's `oauth.v2.access`) return HTTP 200
   * for both successful and failed token exchanges, signalling failure
   * via `{ ok: false, error: "..." }` in the JSON body. Providers that
   * do this implement this hook to surface the real error message
   * instead of letting the response fall through to the generic
   * "missing access_token" branch. Returns `null` when the payload
   * looks healthy.
   */
  detectTokenResponseError?: (payload: unknown) => string | null;
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
    // `access_type=offline` + `prompt=consent` are required to receive a
    // refresh token from Google. Without them the access_token expires in
    // an hour and OpenClaw has no way to renew on its own.
    authorizationExtras: {
      access_type: "offline",
      prompt: "consent",
    },
    // Google returns 4xx on token-exchange errors — the generic
    // exchange.ok check is sufficient, no detector needed.
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
    // No authorize-time extras — Slack ignores access_type/prompt today
    // but a future tightening would reject them, so don't send them.
    detectTokenResponseError: (payload) => {
      if (!payload || typeof payload !== "object") {
        return "Slack returned an empty token response";
      }
      const body = payload as Record<string, unknown>;
      if (body.ok === false) {
        // `error` is the canonical Slack failure code (e.g. "invalid_code",
        // "invalid_client_id"). Surface it verbatim — these strings are
        // safe to display and useful for debugging.
        return typeof body.error === "string" && body.error.length > 0
          ? `Slack OAuth error: ${body.error}`
          : "Slack OAuth error";
      }
      return null;
    },
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
