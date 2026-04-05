import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";
import { UserRepository } from "../repositories/userRepository";
import { IntegrationRepository } from "./integrationRepository";
import { IntegrationService } from "./integrationService";
import { AwsSecretsClient } from "./secretsClient";

const integrationRepository = new IntegrationRepository();
const awsSecretsClient = new AwsSecretsClient();
const integrationService = new IntegrationService(
  integrationRepository,
  awsSecretsClient,
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
  );
