/**
 * OAuth start + complete flows for redirect-based integrations.
 *
 * `start` (authed) issues a signed state token, persists it bound to the
 * caller's userId + integrationId, and returns the provider authorization
 * URL.
 *
 * `complete` (called by the public callback handler) consumes the state
 * token, exchanges the authorization code for an access token, and writes
 * the encoded token bundle to the secret store via the existing
 * IntegrationRepository so connected integrations look identical to the
 * API-key path.
 */

import type { IntegrationRepository } from "./integrationRepository";
import type { OauthStateRepository } from "./oauthStateRepository";
import {
  type SecretsClient,
  buildSecretPath,
  computeKeyHint,
} from "./secretsClient";
import { getOauthProvider, type OauthProviderConfig } from "./oauthProviders";

export type OauthStartResult =
  | { success: true; redirectUrl: string }
  | { success: false; error: string };

export type OauthCompleteResult =
  | {
      success: true;
      integrationId: string;
      userId: string;
      returnPath: string | null;
    }
  | {
      success: false;
      error: string;
      // If state lookup succeeded we can still send the user back to the SPA.
      returnPath: string | null;
    };

export interface OauthEnv {
  /** Public-facing base URL of the core API. Required to register a
   *  callback the provider can hit. e.g. `https://api.meetaxel.ai`. */
  apiBaseUrl: string;
  /** Map of env var name → value, normally `process.env`. Injected so
   *  tests don't need to mutate global state. */
  env: Record<string, string | undefined>;
}

export interface TokenFetcher {
  exchange(
    tokenUrl: string,
    body: URLSearchParams,
  ): Promise<{ ok: boolean; status: number; payload: unknown }>;
}

/**
 * Default token exchange uses `fetch`. Tests inject a stub.
 */
export const defaultTokenFetcher: TokenFetcher = {
  async exchange(tokenUrl, body) {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { ok: response.ok, status: response.status, payload };
  },
};

const STATE_TTL_MS = 10 * 60 * 1000;

export class OauthService {
  private stateRepo: OauthStateRepository;
  private integrationRepo: IntegrationRepository;
  private secrets: SecretsClient;
  private envCfg: OauthEnv;
  private tokens: TokenFetcher;
  private now: () => Date;
  private genToken: () => string;

  constructor(deps: {
    stateRepo: OauthStateRepository;
    integrationRepo: IntegrationRepository;
    secrets: SecretsClient;
    env: OauthEnv;
    tokens?: TokenFetcher;
    now?: () => Date;
    genToken?: () => string;
  }) {
    this.stateRepo = deps.stateRepo;
    this.integrationRepo = deps.integrationRepo;
    this.secrets = deps.secrets;
    this.envCfg = deps.env;
    this.tokens = deps.tokens ?? defaultTokenFetcher;
    this.now = deps.now ?? (() => new Date());
    this.genToken = deps.genToken ?? (() => crypto.randomUUID());
  }

  private callbackUrl(integrationId: string): string {
    const base = this.envCfg.apiBaseUrl.replace(/\/$/, "");
    return `${base}/integrations/${integrationId}/oauth/callback`;
  }

  private resolveCredentials(
    provider: OauthProviderConfig,
  ): { clientId: string; clientSecret: string } | null {
    const clientId = this.envCfg.env[provider.clientIdEnv];
    const clientSecret = this.envCfg.env[provider.clientSecretEnv];
    if (!clientId || !clientSecret) return null;
    return { clientId, clientSecret };
  }

  async start(
    userId: string,
    integrationId: string,
    returnPath: string | null,
  ): Promise<OauthStartResult> {
    const provider = getOauthProvider(integrationId);
    if (!provider) {
      return { success: false, error: "Integration does not support OAuth" };
    }

    const creds = this.resolveCredentials(provider);
    if (!creds) {
      return { success: false, error: "OAuth provider is not configured" };
    }

    const stateToken = this.genToken();
    const expiresAt = new Date(this.now().getTime() + STATE_TTL_MS);

    await this.stateRepo.create({
      userId,
      integrationId,
      stateToken,
      returnPath,
      expiresAt,
    });

    const params = new URLSearchParams({
      client_id: creds.clientId,
      redirect_uri: this.callbackUrl(integrationId),
      response_type: "code",
      scope: provider.scopes.join(" "),
      state: stateToken,
      access_type: "offline",
      prompt: "consent",
    });

    return {
      success: true,
      redirectUrl: `${provider.authorizationUrl}?${params.toString()}`,
    };
  }

  async complete(
    integrationId: string,
    code: string,
    stateToken: string,
  ): Promise<OauthCompleteResult> {
    if (!code || !stateToken) {
      return {
        success: false,
        error: "Missing OAuth code or state",
        returnPath: null,
      };
    }

    const stateRow = await this.stateRepo.findByToken(stateToken);
    if (!stateRow) {
      return {
        success: false,
        error: "Invalid or expired state token",
        returnPath: null,
      };
    }

    // One-time use: consume immediately so a replay can't reuse the token,
    // even if subsequent steps fail.
    await this.stateRepo.deleteByToken(stateToken);

    if (stateRow.integrationId !== integrationId) {
      return {
        success: false,
        error: "State token does not match integration",
        returnPath: stateRow.returnPath,
      };
    }

    if (stateRow.expiresAt.getTime() < this.now().getTime()) {
      return {
        success: false,
        error: "State token has expired",
        returnPath: stateRow.returnPath,
      };
    }

    const provider = getOauthProvider(integrationId);
    if (!provider) {
      return {
        success: false,
        error: "Integration does not support OAuth",
        returnPath: stateRow.returnPath,
      };
    }

    const creds = this.resolveCredentials(provider);
    if (!creds) {
      return {
        success: false,
        error: "OAuth provider is not configured",
        returnPath: stateRow.returnPath,
      };
    }

    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.callbackUrl(integrationId),
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    });

    const exchange = await this.tokens.exchange(provider.tokenUrl, tokenBody);
    if (!exchange.ok) {
      return {
        success: false,
        error: "Token exchange failed",
        returnPath: stateRow.returnPath,
      };
    }

    const payload = exchange.payload as Record<string, unknown> | null;
    const accessToken =
      payload && typeof payload.access_token === "string"
        ? payload.access_token
        : null;
    if (!accessToken) {
      return {
        success: false,
        error: "Token response missing access_token",
        returnPath: stateRow.returnPath,
      };
    }

    // Persist the full token bundle (refresh + expiry too when present).
    // The secret payload is opaque to us — OpenClaw consumes it from the
    // secret store; we never read it back here.
    const secretPayload = JSON.stringify({
      access_token: accessToken,
      refresh_token:
        typeof payload?.refresh_token === "string"
          ? payload.refresh_token
          : null,
      token_type:
        typeof payload?.token_type === "string" ? payload.token_type : null,
      scope: typeof payload?.scope === "string" ? payload.scope : null,
      expires_in:
        typeof payload?.expires_in === "number" ? payload.expires_in : null,
    });

    const secretPath = buildSecretPath(stateRow.userId, integrationId);
    await this.secrets.putSecret(secretPath, secretPayload);

    await this.integrationRepo.upsert({
      userId: stateRow.userId,
      integrationId,
      status: "connected",
      keyHint: computeKeyHint(accessToken),
      secretPath,
      connectedAt: this.now(),
    });

    return {
      success: true,
      integrationId,
      userId: stateRow.userId,
      returnPath: stateRow.returnPath,
    };
  }
}
