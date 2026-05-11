import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { getDb } from "@axel-saas/db";
import {
  userRepository,
  UserRepository,
  withNotificationDefaults,
} from "../repositories/userRepository";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { AccountDeletionService } from "./accountDeletionService";

const NAME_MIN_LENGTH = 1;
const NAME_MAX_LENGTH = 100;

export const userHandler = new Elysia({ name: "UserHandler" })
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/users/me",
    async (ctx) => {
      const { set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        return {
          success: true,
          user: {
            id: dbUser.id,
            email: dbUser.email,
            fullName: dbUser.fullName,
            onboardingCompleted: dbUser.onboardingCompleted,
            notificationPreferences: withNotificationDefaults(
              dbUser.notificationPreferences,
            ),
            createdAt: dbUser.createdAt,
            updatedAt: dbUser.updatedAt,
          },
        };
      } catch (error) {
        console.error("Get user error:", error);
        set.status = 500;
        return { success: false, error: "Failed to fetch user profile" };
      }
    },
    {
      detail: {
        description: "Get current user profile",
        tags: ["Users"],
      },
    },
  )
  .put(
    "/users/me",
    async (ctx) => {
      const { body, set } = ctx;
      const supabaseUserId = getUser(ctx).sub;

      // Trim & validate length again here even though Elysia's `t.String`
      // already enforces it — Elysia validates the raw body, but a body
      // of "  " would slip past minLength: 1. The user-visible error is
      // the same either way.
      const name = body.name.trim();
      if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
        set.status = 400;
        return {
          success: false,
          error: `Name must be ${NAME_MIN_LENGTH}–${NAME_MAX_LENGTH} characters`,
        };
      }

      try {
        const dbUser = await userRepository.getUserBySupabaseId(supabaseUserId);
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        const updated = await userRepository.updateProfile(dbUser.id, {
          fullName: name,
        });
        if (!updated) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        return {
          success: true,
          user: {
            id: updated.id,
            email: updated.email,
            fullName: updated.fullName,
            onboardingCompleted: updated.onboardingCompleted,
            notificationPreferences: withNotificationDefaults(
              updated.notificationPreferences,
            ),
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
        };
      } catch (error) {
        console.error("Update profile error:", error);
        set.status = 500;
        return { success: false, error: "Failed to update profile" };
      }
    },
    {
      body: t.Object({
        name: t.String({
          minLength: NAME_MIN_LENGTH,
          maxLength: NAME_MAX_LENGTH,
        }),
      }),
      detail: {
        description: "Update the current user's profile name",
        tags: ["Users"],
      },
    },
  )
  .put(
    "/users/me/notifications",
    async (ctx) => {
      const { body, set } = ctx;
      const supabaseUserId = getUser(ctx).sub;

      try {
        const dbUser = await userRepository.getUserBySupabaseId(supabaseUserId);
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        // Merge against the existing row so a partial PUT never silently
        // resets a key the client didn't send. New keys default to their
        // canonical default if absent on both sides.
        const next = withNotificationDefaults({
          ...withNotificationDefaults(dbUser.notificationPreferences),
          ...body,
        });

        const stored = await userRepository.updateNotificationPreferences(
          dbUser.id,
          next,
        );
        if (!stored) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        return {
          success: true,
          notificationPreferences: withNotificationDefaults(stored),
        };
      } catch (error) {
        console.error("Update notification preferences error:", error);
        set.status = 500;
        return {
          success: false,
          error: "Failed to update notification preferences",
        };
      }
    },
    {
      body: t.Object({
        emailNotifications: t.Optional(t.Boolean()),
        weeklyDigest: t.Optional(t.Boolean()),
      }),
      detail: {
        description: "Update notification preferences",
        tags: ["Users"],
      },
    },
  )
  .delete(
    "/users/me",
    async (ctx) => {
      const { set } = ctx;
      const supabaseUserId = getUser(ctx).sub;

      // Don't 404 on a missing DB row here — the service is responsible
      // for finishing partial-failure retries (DB cascade succeeded but
      // the prior auth-admin call timed out). The orphan-cleanup branch
      // inside `deleteAccount` still removes the auth.users row in that
      // case. Without this delegation, the auth row would stay
      // orphaned forever because the handler would short-circuit
      // before reaching the service.
      try {
        const db = getDb();
        const service = new AccountDeletionService({
          userRepo: new UserRepository(db),
          subscriptionRepo: new SubscriptionRepository(db),
        });

        const result = await service.deleteAccount({ supabaseUserId });

        if (!result.success) {
          // Map internal reasons to HTTP status:
          //   - `auth_not_configured` → 503: pre-flight aborted before
          //     ANY destructive op. The service-role key is missing on
          //     this stage. No retry will help until ops set the secret.
          //   - `stripe_cancel_failed` → 502: upstream provider failed,
          //     retry is meaningful.
          //   - DB / auth-delete → 500: the service is idempotent, the
          //     caller can retry.
          if (result.reason === "auth_not_configured") set.status = 503;
          else if (result.reason === "stripe_cancel_failed") set.status = 502;
          else set.status = 500;
          return {
            success: false,
            error:
              result.reason === "auth_not_configured"
                ? "Account deletion isn't available right now. Please contact support."
                : "Account deletion failed. Please try again or contact support.",
          };
        }

        return { success: true };
      } catch (error) {
        console.error("Delete account error:", error);
        set.status = 500;
        return { success: false, error: "Failed to delete account" };
      }
    },
    {
      detail: {
        description:
          "Permanently delete the authenticated user's account and all owned data",
        tags: ["Users"],
      },
    },
  );
