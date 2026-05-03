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
import { RateLimitService } from "../rate-limiting/rateLimitService";
import {
  applyRateLimitHeaders,
  buildRateLimitedBody,
} from "../rate-limiting/rateLimitHeaders";

const tokenUsageService = new TokenUsageService();
const rateLimitService = new RateLimitService();

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

      // Per-user read rate limit (Free 60/min, Premium/Enterprise
      // 120/min). Settings polls this on mount, so the limit is
      // generous enough that normal navigation never trips it.
      const decision = await rateLimitService.checkAndConsume({
        userId: dbUser.id,
        category: "read",
        tier,
      });
      applyRateLimitHeaders(ctx, decision);
      if (!decision.allowed) {
        set.status = 429;
        return buildRateLimitedBody(
          decision,
          "You're refreshing usage too quickly — please wait a moment.",
        );
      }

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
