import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";
import { UserRepository } from "../repositories/userRepository";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { IntegrationRepository } from "./integrationRepository";
import { IntegrationService } from "./integrationService";
import { OauthStateRepository } from "./oauthStateRepository";
import { OauthService } from "./oauthService";
import { AwsSecretsClient } from "./secretsClient";
import { checkIntegrationTierGate, type SubscriptionTier } from "./tierGate";

const integrationRepository = new IntegrationRepository();
const oauthStateRepository = new OauthStateRepository();
const awsSecretsClient = new AwsSecretsClient();
const integrationService = new IntegrationService(
  integrationRepository,
  awsSecretsClient,
);
const oauthService = new OauthService({
  stateRepo: oauthStateRepository,
  integrationRepo: integrationRepository,
  secrets: awsSecretsClient,
  env: {
    apiBaseUrl: process.env.API_BASE_URL || "http://localhost:5173/api",
    env: process.env,
  },
});

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
      }
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

      const result = await integrationService.revoke(
        dbUser.id,
        params.integrationId,
      );

      if (!result.success) {
        set.status = result.error === "Integration not found" ? 404 : 400;
      }
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
