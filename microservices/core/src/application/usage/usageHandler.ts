import Elysia from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";
import { UserRepository } from "../repositories/userRepository";
import { TokenUsageService } from "./tokenUsageService";
import type { SubscriptionTier } from "../integrations/tierGate";

const tokenUsageService = new TokenUsageService();

export const usageHandler = new Elysia({ name: "UsageHandler" })
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/users/me/usage",
    async (ctx) => {
      const { set } = ctx;
      const { sub: supabaseUserId } = getUser(ctx);

      const db = getDb();
      const userRepo = new UserRepository(db);
      // findBySupabaseId already loads the user's subscription as part of
      // the UserWithRelations projection, so reading dbUser.subscription
      // avoids a redundant SELECT on subscriptions for every usage query.
      const dbUser = await userRepo.findBySupabaseId(supabaseUserId);
      if (!dbUser) {
        set.status = 404;
        return { success: false, error: "User not found" };
      }

      const tier = (dbUser.subscription?.tier ??
        null) as SubscriptionTier | null;

      const summary = await tokenUsageService.getSummary(dbUser.id, tier);
      return { success: true, usage: summary };
    },
    {
      detail: {
        description: "Get the user's current token usage + tier limits",
        tags: ["Usage"],
      },
    },
  );
