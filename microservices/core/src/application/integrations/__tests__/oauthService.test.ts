import { describe, it, expect, vi, beforeEach } from "vitest";
import { OauthService, type TokenFetcher } from "../oauthService";
import type { OauthStateRepository } from "../oauthStateRepository";
import type { IntegrationRepository } from "../integrationRepository";
import type { SecretsClient } from "../secretsClient";

const NOW = new Date("2026-05-02T12:00:00.000Z");
const TEN_MIN_LATER = new Date("2026-05-02T12:10:00.000Z");
const ELEVEN_MIN_LATER = new Date("2026-05-02T12:11:00.000Z");

const ENV_CONFIGURED = {
  apiBaseUrl: "https://api.example.com",
  env: {
    GOOGLE_OAUTH_CLIENT_ID: "google-client",
    GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
    SLACK_OAUTH_CLIENT_ID: "slack-client",
    SLACK_OAUTH_CLIENT_SECRET: "slack-secret",
  },
};

function makeStateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "state-uuid",
    userId: "user-uuid-1",
    integrationId: "google",
    stateToken: "state-token-abc",
    returnPath: "/integrations",
    expiresAt: TEN_MIN_LATER,
    createdAt: NOW,
    ...overrides,
  };
}

function setup(opts?: {
  envOverrides?: Record<string, string | undefined>;
  apiBaseUrl?: string;
  tokenResponse?: { ok: boolean; status: number; payload: unknown };
  now?: Date;
}) {
  const stateRepo = {
    create: vi.fn().mockResolvedValue(makeStateRow()),
    findByToken: vi.fn().mockResolvedValue(makeStateRow()),
    deleteByToken: vi.fn().mockResolvedValue(undefined),
  };
  const integrationRepo = {
    upsert: vi.fn().mockResolvedValue(undefined),
  };
  const secrets: SecretsClient = {
    putSecret: vi.fn(),
    deleteSecret: vi.fn(),
    secretExists: vi.fn(),
  };
  const tokens: TokenFetcher = {
    exchange: vi.fn().mockResolvedValue(
      opts?.tokenResponse ?? {
        ok: true,
        status: 200,
        payload: {
          access_token: "ya29.example-access-token",
          refresh_token: "1//example-refresh-token",
          token_type: "Bearer",
          scope: "openid email",
          expires_in: 3600,
        },
      },
    ),
  };

  const env = opts?.envOverrides
    ? { ...ENV_CONFIGURED.env, ...opts.envOverrides }
    : ENV_CONFIGURED.env;

  const service = new OauthService({
    stateRepo: stateRepo as unknown as OauthStateRepository,
    integrationRepo: integrationRepo as unknown as IntegrationRepository,
    secrets,
    env: { apiBaseUrl: opts?.apiBaseUrl ?? ENV_CONFIGURED.apiBaseUrl, env },
    tokens,
    now: () => opts?.now ?? NOW,
    genToken: () => "state-token-abc",
  });

  return { service, stateRepo, integrationRepo, secrets, tokens };
}

describe("OauthService.start", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns a redirect URL with state, scopes, and callback", async () => {
    const { service, stateRepo } = setup();

    const result = await service.start(
      "user-uuid-1",
      "google",
      "/integrations",
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    const url = new URL(result.redirectUrl);
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("state")).toBe("state-token-abc");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/integrations/google/oauth/callback",
    );
    expect(url.searchParams.get("scope")).toContain("openid");
    expect(url.searchParams.get("response_type")).toBe("code");

    expect(stateRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-uuid-1",
        integrationId: "google",
        stateToken: "state-token-abc",
        returnPath: "/integrations",
      }),
    );
  });

  it("rejects integrations without an OAuth provider", async () => {
    const { service } = setup();
    const result = await service.start("user-uuid-1", "openai", null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("does not support OAuth");
    }
  });

  it("rejects when client credentials are not configured", async () => {
    const { service } = setup({
      envOverrides: { GOOGLE_OAUTH_CLIENT_ID: undefined },
    });
    const result = await service.start("user-uuid-1", "google", null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not configured");
    }
  });

  it("strips a trailing slash from apiBaseUrl when building the callback", async () => {
    const { service } = setup({ apiBaseUrl: "https://api.example.com/" });
    const result = await service.start("user-uuid-1", "google", null);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://api.example.com/integrations/google/oauth/callback",
    );
  });
});

describe("OauthService.complete", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exchanges the code, persists the secret, upserts metadata", async () => {
    const { service, stateRepo, integrationRepo, secrets, tokens } = setup();

    const result = await service.complete(
      "google",
      "auth-code-xyz",
      "state-token-abc",
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.integrationId).toBe("google");
    expect(result.userId).toBe("user-uuid-1");
    expect(result.returnPath).toBe("/integrations");

    expect(stateRepo.deleteByToken).toHaveBeenCalledWith("state-token-abc");
    expect(tokens.exchange).toHaveBeenCalledOnce();

    expect(secrets.putSecret).toHaveBeenCalledOnce();
    const [path, payload] = (secrets.putSecret as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    expect(path).toBe(
      "/axel-saas/users/user-uuid-1/integrations/google/credential",
    );
    const parsed = JSON.parse(payload as string);
    expect(parsed.access_token).toBe("ya29.example-access-token");
    expect(parsed.refresh_token).toBe("1//example-refresh-token");

    expect(integrationRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-uuid-1",
        integrationId: "google",
        status: "connected",
        secretPath:
          "/axel-saas/users/user-uuid-1/integrations/google/credential",
      }),
    );
  });

  it("rejects missing code or state", async () => {
    const { service } = setup();
    const r1 = await service.complete("google", "", "state");
    expect(r1.success).toBe(false);
    const r2 = await service.complete("google", "code", "");
    expect(r2.success).toBe(false);
  });

  it("rejects an unknown state token", async () => {
    const { service, stateRepo } = setup();
    stateRepo.findByToken.mockResolvedValue(null);

    const result = await service.complete("google", "code", "wrong-state");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid or expired");
    }
  });

  it("rejects when state is bound to a different integration", async () => {
    const { service, stateRepo, secrets } = setup();
    stateRepo.findByToken.mockResolvedValue(
      makeStateRow({ integrationId: "slack" }),
    );

    const result = await service.complete("google", "code", "state-token-abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("does not match");
    }
    expect(secrets.putSecret).not.toHaveBeenCalled();
  });

  it("rejects an expired state token", async () => {
    const { service, secrets } = setup({ now: ELEVEN_MIN_LATER });

    const result = await service.complete("google", "code", "state-token-abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("expired");
    }
    expect(secrets.putSecret).not.toHaveBeenCalled();
  });

  it("rejects when token exchange returns non-OK", async () => {
    const { service, secrets } = setup({
      tokenResponse: { ok: false, status: 401, payload: { error: "bad" } },
    });
    const result = await service.complete("google", "code", "state-token-abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Token exchange failed");
      expect(result.returnPath).toBe("/integrations");
    }
    expect(secrets.putSecret).not.toHaveBeenCalled();
  });

  it("rejects when token response has no access_token", async () => {
    const { service, secrets } = setup({
      tokenResponse: { ok: true, status: 200, payload: { error: "nope" } },
    });
    const result = await service.complete("google", "code", "state-token-abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("missing access_token");
    }
    expect(secrets.putSecret).not.toHaveBeenCalled();
  });

  it("returns config error if the provider becomes unconfigured between start and complete", async () => {
    const { service, secrets } = setup({
      envOverrides: { GOOGLE_OAUTH_CLIENT_SECRET: undefined },
    });
    const result = await service.complete("google", "code", "state-token-abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("not configured");
    }
    expect(secrets.putSecret).not.toHaveBeenCalled();
  });

  it("rejects when integration has no OAuth provider", async () => {
    // findByToken returns the state row regardless; the integration check
    // catches a state row whose integration was OAuth-removed.
    const { service, stateRepo } = setup();
    stateRepo.findByToken.mockResolvedValue(
      makeStateRow({ integrationId: "openai" }),
    );

    const result = await service.complete("openai", "code", "state-token-abc");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("does not support OAuth");
    }
  });

  it("consumes the state token even when the exchange fails (no replay window)", async () => {
    const { service, stateRepo } = setup({
      tokenResponse: { ok: false, status: 500, payload: null },
    });
    await service.complete("google", "code", "state-token-abc");
    expect(stateRepo.deleteByToken).toHaveBeenCalledWith("state-token-abc");
  });

  it("handles a missing token payload (json parse failure path)", async () => {
    const { service } = setup({
      tokenResponse: { ok: true, status: 200, payload: null },
    });
    const result = await service.complete("google", "code", "state-token-abc");
    expect(result.success).toBe(false);
  });
});
