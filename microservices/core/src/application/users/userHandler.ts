import Elysia, { t } from "elysia";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { userRepository } from "../repositories/userRepository";

// Cached per Lambda warm instance — avoids re-fetching on every request
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!_jwks) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL environment variable is not set");
    }
    _jwks = createRemoteJWKSet(
      new URL(
        `${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`,
      ),
    );
  }
  return _jwks;
}

async function getAuthUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[getAuthUser] Missing or malformed Authorization header");
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getJwks());
    return payload as { sub: string; email: string };
  } catch (err) {
    console.error("[getAuthUser] JWT verification failed:", err);
    return null;
  }
}

export const userHandler = new Elysia({ name: "UserHandler" })
  .get(
    "/users/me",
    async ({ headers, set }) => {
      const authUser = await getAuthUser(headers.authorization);
      if (!authUser?.sub) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      try {
        const user = await userRepository.getUserBySupabaseId(authUser.sub);
        if (!user) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            onboardingCompleted: user.onboardingCompleted,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
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
  .post(
    "/users/onboarding",
    async ({ body, headers, set }) => {
      const authUser = await getAuthUser(headers.authorization);
      if (!authUser?.sub) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }

      try {
        // Get user from database
        const dbUser = await userRepository.getUserBySupabaseId(authUser.sub);
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        // Update onboarding answers
        await userRepository.updateOnboardingAnswers(dbUser.id, body);

        // Mark onboarding as completed
        await userRepository.updateUser(dbUser.id, {
          onboardingCompleted: true,
        });

        return { success: true, userId: dbUser.id };
      } catch (error) {
        console.error("Onboarding error:", error);
        set.status = 500;
        return { success: false, error: "Failed to complete onboarding" };
      }
    },
    {
      body: t.Object({
        name: t.String(),
        role: t.Optional(t.String()),
        helpWith: t.Array(t.String()),
        typicalDay: t.Optional(t.String()),
        channels: t.Array(t.String()),
        morningBrief: t.Boolean(),
        briefTime: t.Optional(t.String()),
      }),
      detail: {
        description: "Complete user onboarding",
        tags: ["Users"],
      },
    },
  );
