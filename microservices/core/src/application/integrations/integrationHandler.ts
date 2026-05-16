import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";
import { UserRepository } from "../repositories/userRepository";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { ProvisioningRepository } from "../repositories/provisioningRepository";
import { IntegrationRepository } from "./integrationRepository";
import { IntegrationService } from "./integrationService";
import {
  isPremiumOnlyIntegration,
  checkIntegrationTierGate,
  type SubscriptionTier,
} from "./tierGate";
import { OauthStateRepository } from "./oauthStateRepository";
import { OauthService } from "./oauthService";
import { AwsSecretsClient } from "./secretsClient";
import { RateLimitService } from "../rate-limiting/rateLimitService";
import {
  applyRateLimitHeaders,
  buildRateLimitedBody,
} from "../rate-limiting/rateLimitHeaders";
import type { RateLimitCategory } from "../rate-limiting/rateLimitConfig";
import { WorkspaceConfigService } from "../workspace/workspaceConfigService";
import { syncWorkspaceAfterIntegrationChange } from "../workspace/integrationsSync";

const integrationRepository = new IntegrationRepository();
const provisioningRepository = new ProvisioningRepository();
const oauthStateRepository = new OauthStateRepository();
const awsSecretsClient = new AwsSecretsClient();
const integrationService = new IntegrationService(
  integrationRepository,
  awsSecretsClient,
);
// Shared by both the workspace service AND the integrations-sync
// orchestrator so operator signals from either layer land under the
// same `[workspace-sync]` prefix in CloudWatch. The orchestrator
// emits the "openclaw.json malformed; skipping regen" warning that
// previously dropped silently because the orchestrator's logger was
// optional with a noop default (caught by bugbot on #104).
const workspaceLogger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(`[workspace-sync] ${msg}`, ctx ?? {}),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(`[workspace-sync] ${msg}`, ctx ?? {}),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(`[workspace-sync] ${msg}`, ctx ?? {}),
};

const workspaceConfigService = new WorkspaceConfigService({
  provisioningRepo: provisioningRepository,
  logger: workspaceLogger,
});
const oauthService = new OauthService({
  stateRepo: oauthStateRepository,
  integrationRepo: integrationRepository,
  secrets: awsSecretsClient,
  env: {
    apiBaseUrl: process.env.API_BASE_URL || "http://localhost:5173/api",
    env: process.env,
  },
});
const rateLimitService = new RateLimitService();

/**
 * Workspace sync. We DO await this — but that's fast now:
 * `WorkspaceConfigService.updateFiles` blocks only for the file
 * write (~tens of ms typical) and dispatches the reload signal
 * detached. The reload's up-to-10s HTTP timeout therefore can't
 * pin latency on the user's `Connect` / `Revoke` HTTP response.
 *
 * Two failure modes worth keeping straight:
 *   - **File write failure** — propagated as a thrown error here.
 *     We catch + log so the integration mutation (already
 *     persisted to DB + Secrets Manager) still reports success;
 *     the workspace will pick up the change on the container's
 *     next heartbeat per the spec's fallback.
 *   - **Reload failure / timeout** — already logged and swallowed
 *     inside the service's detached promise. Nothing surfaces
 *     here.
 */
async function safelySyncWorkspace(
  userId: string,
  tier: SubscriptionTier | null,
  reason: "integration_changed" | "byom_changed",
): Promise<void> {
  try {
    await syncWorkspaceAfterIntegrationChange(
      {
        integrationService,
        workspaceConfigService,
        // Same logger as the workspace service so a malformed
        // openclaw.json warning lands under the same prefix and
        // doesn't get silently dropped.
        logger: workspaceLogger,
      },
      userId,
      tier,
      { reason },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[workspace-sync] post-mutation sync failed", {
      userId,
      reason,
      error: message,
    });
  }
}

/**
 * OAuth callbacks land unauthenticated, so the user's tier can't
 * come from `derive` — look it up from the DB using the userId
 * returned by `oauthService.complete`. Returns `null` on lookup
 * failure; the workspace sync tolerates a null tier.
 */
async function resolveUserTier(
  userId: string,
): Promise<SubscriptionTier | null> {
  try {
    const subRepo = new SubscriptionRepository(getDb());
    const sub = await subRepo.findByUserId(userId);
    return (sub?.tier ?? null) as SubscriptionTier | null;
  } catch {
    return null;
  }
}

/**
 * Helper for the three protected integration mutations
 * (`/connect`, `/revoke`, `/oauth/start`). Returns the 429 body when
 * blocked, or `null` to continue. Headers are applied either way so
 * the frontend can read remaining quota even on success.
 */
async function applyIntegrationRateLimit(
  // Permissive context shape — same approach as `applyRateLimitHeaders`.
  // Elysia's `set` is a branded type that doesn't structurally match
  // narrow inline definitions, so the helper accepts anything with a
  // status + headers bag and lets the headers write happen in place.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: { set: { status?: any; headers?: any } },
  userId: string,
  tier: SubscriptionTier | null,
  category: RateLimitCategory,
) {
  const decision = await rateLimitService.checkAndConsume({
    userId,
    category,
    tier,
  });
  applyRateLimitHeaders(ctx, decision);
  if (!decision.allowed) {
    ctx.set.status = 429;
    return buildRateLimitedBody(
      decision,
      "You're moving fast — give it a moment and try again.",
    );
  }
  return null;
}

function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
}

function buildReturnUrl(returnPath: string | null, params: URLSearchParams) {
  const base = appUrl();
  const path = returnPath || "/integrations";
  // Reject anything that isn't a same-origin path — defends against an
  // attacker stuffing an absolute redirect into the state row.
  const safePath = path.startsWith("/") ? path : "/integrations";
  const sep = safePath.includes("?") ? "&" : "?";
  return `${base}${safePath}${sep}${params.toString()}`;
}

// Public — providers redirect to the OAuth callback without our auth header,
// so it must live on a separate Elysia instance from the protected routes.
export const integrationPublicHandler = new Elysia({
  name: "IntegrationPublicHandler",
}).get(
  "/integrations/:integrationId/oauth/callback",
  async (ctx) => {
    const { params, query, set } = ctx;
    const code = typeof query.code === "string" ? query.code : "";
    const state = typeof query.state === "string" ? query.state : "";
    const providerError = typeof query.error === "string" ? query.error : null;

    if (providerError) {
      set.redirect = buildReturnUrl(
        null,
        new URLSearchParams({ error: providerError }),
      );
      return;
    }

    const result = await oauthService.complete(
      params.integrationId,
      code,
      state,
    );

    if (result.success) {
      // OAuth callback runs unauthenticated (the provider redirects
      // the browser here), so we don't have the user's `tier` from
      // an Elysia derive — pull it from the DB using the userId
      // returned by `complete`.
      const tier = await resolveUserTier(result.userId);
      await safelySyncWorkspace(
        result.userId,
        tier,
        isPremiumOnlyIntegration(result.integrationId)
          ? "byom_changed"
          : "integration_changed",
      );
    }

    const search = new URLSearchParams(
      result.success
        ? { connected: result.integrationId }
        : { error: result.error },
    );
    set.redirect = buildReturnUrl(result.returnPath, search);
  },
  {
    detail: {
      description: "Complete an OAuth authorization (provider-driven)",
      tags: ["Integrations"],
    },
  },
);

export const integrationHandler = new Elysia({
  name: "IntegrationHandler",
})
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .post(
    "/integrations/:integrationId/connect",
    async (ctx) => {
      const { body, params, set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const subRepo = new SubscriptionRepository(db);
      const subscription = await subRepo.findByUserId(dbUser.id);
      const tier = (subscription?.tier ?? null) as SubscriptionTier | null;

      const blocked = await applyIntegrationRateLimit(
        ctx,
        dbUser.id,
        tier,
        "write",
      );
      if (blocked) return blocked;

      const gate = checkIntegrationTierGate(params.integrationId, tier);
      if (!gate.allowed) {
        set.status = 403;
        return { success: false, error: gate.reason };
      }

      const result = await integrationService.connect(
        dbUser.id,
        params.integrationId,
        body.credential,
        body.label,
      );

      if (!result.success) {
        set.status = 400;
        return result;
      }

      // Workspace sync — regenerate TOOLS.md from the new integrations
      // list and (best-effort) ask the running container to reload.
      // BYOM (openai/anthropic) flows through the same path; the
      // generator derives the BYOM block from the connected list, so
      // a different `reason` is all that's needed for log clarity.
      await safelySyncWorkspace(
        dbUser.id,
        tier,
        isPremiumOnlyIntegration(params.integrationId)
          ? "byom_changed"
          : "integration_changed",
      );

      return result;
    },
    {
      body: t.Object({
        credential: t.String({ minLength: 1 }),
        label: t.Optional(t.String()),
      }),
      detail: {
        description: "Connect an integration by submitting a credential",
        tags: ["Integrations"],
      },
    },
  )
  .get(
    "/integrations",
    async (ctx) => {
      const { set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const tier = (dbUser.subscription?.tier ??
        null) as SubscriptionTier | null;
      const blocked = await applyIntegrationRateLimit(
        ctx,
        dbUser.id,
        tier,
        "read",
      );
      if (blocked) return blocked;

      const integrations = await integrationService.list(dbUser.id);
      return { success: true, integrations };
    },
    {
      detail: {
        description:
          "List all integrations for the current user (safe metadata only)",
        tags: ["Integrations"],
      },
    },
  )
  .get(
    "/integrations/:integrationId",
    async (ctx) => {
      const { params, set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const tier = (dbUser.subscription?.tier ??
        null) as SubscriptionTier | null;
      const blocked = await applyIntegrationRateLimit(
        ctx,
        dbUser.id,
        tier,
        "read",
      );
      if (blocked) return blocked;

      const integration = await integrationService.get(
        dbUser.id,
        params.integrationId,
      );
      if (!integration) {
        set.status = 404;
        return { success: false, error: "Integration not found" };
      }
      return { success: true, integration };
    },
    {
      detail: {
        description: "Get a single integration's safe metadata",
        tags: ["Integrations"],
      },
    },
  )
  .post(
    "/integrations/:integrationId/revoke",
    async (ctx) => {
      const { params, set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const tier = (dbUser.subscription?.tier ??
        null) as SubscriptionTier | null;
      const blocked = await applyIntegrationRateLimit(
        ctx,
        dbUser.id,
        tier,
        "write",
      );
      if (blocked) return blocked;

      const result = await integrationService.revoke(
        dbUser.id,
        params.integrationId,
      );

      if (!result.success) {
        set.status = result.error === "Integration not found" ? 404 : 400;
        return result;
      }

      await safelySyncWorkspace(
        dbUser.id,
        tier,
        isPremiumOnlyIntegration(params.integrationId)
          ? "byom_changed"
          : "integration_changed",
      );

      return result;
    },
    {
      detail: {
        description: "Revoke an integration and delete its secret",
        tags: ["Integrations"],
      },
    },
  )
  .post(
    "/integrations/:integrationId/oauth/start",
    async (ctx) => {
      const { params, body, set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const subRepo = new SubscriptionRepository(db);
      const subscription = await subRepo.findByUserId(dbUser.id);
      const tier = (subscription?.tier ?? null) as SubscriptionTier | null;

      const blocked = await applyIntegrationRateLimit(
        ctx,
        dbUser.id,
        tier,
        "write",
      );
      if (blocked) return blocked;

      const gate = checkIntegrationTierGate(params.integrationId, tier);
      if (!gate.allowed) {
        set.status = 403;
        return { success: false, error: gate.reason };
      }

      const result = await oauthService.start(
        dbUser.id,
        params.integrationId,
        body?.returnPath ?? null,
      );

      if (!result.success) {
        set.status = 400;
      }
      return result;
    },
    {
      body: t.Optional(
        t.Object({
          returnPath: t.Optional(t.String()),
        }),
      ),
      detail: {
        description: "Begin an OAuth authorization flow",
        tags: ["Integrations"],
      },
    },
  );
