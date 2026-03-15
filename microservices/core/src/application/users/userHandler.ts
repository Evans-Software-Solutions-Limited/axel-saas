import Elysia from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { userRepository } from "../repositories/userRepository";

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
  );
