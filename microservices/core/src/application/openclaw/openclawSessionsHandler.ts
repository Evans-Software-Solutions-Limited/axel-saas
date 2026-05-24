/**
 * Elysia handler for OpenClaw session lifecycle endpoints.
 *
 * Spec reference: `docs/openclaw-fargate-spec.md` §7.
 *
 *   POST   /openclaw/sessions            { name }      — start
 *   DELETE /openclaw/sessions/:id                       — stop
 *   GET    /openclaw/sessions                           — list (this user)
 *
 * Auth: `requireAuth` derives the authenticated Supabase user; the
 * DB userId is resolved from the JWT, never the body. The DELETE
 * route additionally checks ownership inside the service (`forbidden`
 * → 404 to avoid leaking session-ID existence).
 */

import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";

import { UserRepository } from "../repositories/userRepository";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { OpenclawSessionsRepository } from "./openclawSessionsRepository";
import {
  OpenclawSessionsService,
  type AwsClientFactory,
} from "./openclawSessionsService";
import { getOpenclawInfra } from "./ssmContract";
import {
  getEc2Client,
  getEcsClient,
  getEfsClient,
  getElbV2Client,
} from "./awsClients";
import type { SubscriptionTier } from "../integrations/tierGate";
import { RateLimitService } from "../rate-limiting/rateLimitService";
import {
  applyRateLimitHeaders,
  buildRateLimitedBody,
} from "../rate-limiting/rateLimitHeaders";
import type { RateLimitCategory } from "../rate-limiting/rateLimitConfig";

const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(`[openclaw-sessions] ${msg}`, ctx ?? {}),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(`[openclaw-sessions] ${msg}`, ctx ?? {}),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(`[openclaw-sessions] ${msg}`, ctx ?? {}),
};

/** Lazy because resolving the apiCaller role ARN needs an SSM round-trip. */
function buildClientFactory(): AwsClientFactory {
  return {
    async getEcs() {
      const infra = await getOpenclawInfra();
      return getEcsClient({ roleArn: infra.apiCallerRoleArn });
    },
    async getElbV2() {
      const infra = await getOpenclawInfra();
      return getElbV2Client({ roleArn: infra.apiCallerRoleArn });
    },
    async getEfs() {
      const infra = await getOpenclawInfra();
      return getEfsClient({ roleArn: infra.apiCallerRoleArn });
    },
    async getEc2() {
      const infra = await getOpenclawInfra();
      return getEc2Client({ roleArn: infra.apiCallerRoleArn });
    },
  };
}

const sessionsRepository = new OpenclawSessionsRepository();
const sessionsService = new OpenclawSessionsService({
  repository: sessionsRepository,
  loadInfra: () => getOpenclawInfra(),
  awsClients: buildClientFactory(),
  logger,
  gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || null,
});

// Exported so the Stripe webhook handler can reach the same singleton
// without rebuilding AWS client state — see stripeHandler.ts.
export { sessionsService as openclawSessionsService };

const rateLimitService = new RateLimitService();

async function applyOpenclawRateLimit(
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

export const openclawSessionsHandler = new Elysia({
  name: "OpenclawSessionsHandler",
})
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .post(
    "/openclaw/sessions",
    async (ctx) => {
      const { body, set } = ctx;
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

      const blocked = await applyOpenclawRateLimit(
        ctx,
        dbUser.id,
        tier,
        "write",
      );
      if (blocked) return blocked;

      try {
        const result = await sessionsService.createSession({
          userId: dbUser.id,
          tier,
          name: body.name,
        });
        switch (result.kind) {
          case "created":
          case "existing":
            set.status = result.kind === "created" ? 201 : 200;
            return {
              success: true,
              sessionId: result.sessionId,
              name: result.name,
              url: result.url,
              taskArn: result.taskArn,
              expiresAt: result.expiresAt,
            };
          case "invalid_name":
            set.status = 400;
            return { success: false, error: result.reason };
          case "name_conflict":
            set.status = 409;
            return {
              success: false,
              error: "Session name is already in use",
            };
          case "concurrency_cap":
            set.status = 429;
            return {
              success: false,
              error: "Concurrent session limit reached for your tier",
              current: result.current,
              limit: result.limit,
            };
          case "dns_unavailable":
            set.status = 503;
            return {
              success: false,
              error: "OpenClaw sessions are not available on this stage",
            };
        }
      } catch (err) {
        logger.error("createSession failed", {
          userId: dbUser.id,
          error: err instanceof Error ? err.message : String(err),
        });
        set.status = 500;
        return { success: false, error: "Failed to create session" };
      }
    },
    {
      body: t.Object({ name: t.String({ minLength: 3, maxLength: 63 }) }),
      detail: {
        description: "Start a per-user OpenClaw Fargate session",
        tags: ["OpenClaw"],
      },
    },
  )
  .delete(
    "/openclaw/sessions/:sessionId",
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

      try {
        const result = await sessionsService.stopSession({
          sessionId: params.sessionId,
          userId: dbUser.id,
          reason: "user",
        });
        switch (result.kind) {
          case "stopped":
            set.status = 204;
            return;
          case "not_found":
          case "forbidden":
            // Map "forbidden" → 404 so existence isn't leaked.
            set.status = 404;
            return { success: false, error: "Session not found" };
        }
      } catch (err) {
        logger.error("stopSession failed", {
          userId: dbUser.id,
          sessionId: params.sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        set.status = 500;
        return { success: false, error: "Failed to stop session" };
      }
    },
    {
      // UUID validation at the route boundary. Without this, a
      // malformed input (`DELETE /openclaw/sessions/not-a-uuid`)
      // reaches the repository's `where(eq(id, "not-a-uuid"))`
      // against a uuid column, Postgres throws `invalid input
      // syntax for type uuid (22P02)`, the catch returns 500, and
      // the client sees "Failed to stop session" instead of the
      // 404 they should have got. The regex is the broad UUID
      // shape — any version, lower-or-upper hex — because the
      // service is happy to receive any well-formed UUID even
      // though we only mint v4s ourselves.
      params: t.Object({
        sessionId: t.String({
          pattern:
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        }),
      }),
      detail: {
        description: "Stop an OpenClaw session and release its AWS resources",
        tags: ["OpenClaw"],
      },
    },
  )
  .get(
    "/openclaw/sessions",
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

      const rows = await sessionsRepository.listActiveByUserId(dbUser.id);
      const infra = await getOpenclawInfra().catch(() => null);
      const dnsSuffix = infra?.dnsSuffix ?? null;

      return {
        success: true,
        sessions: rows.map((r) => ({
          sessionId: r.id,
          name: r.name,
          taskArn: r.taskArn,
          startedAt: r.startedAt.toISOString(),
          url: dnsSuffix ? `https://${r.name}.${dnsSuffix}` : null,
        })),
      };
    },
    {
      detail: {
        description: "List the authenticated user's active OpenClaw sessions",
        tags: ["OpenClaw"],
      },
    },
  );
