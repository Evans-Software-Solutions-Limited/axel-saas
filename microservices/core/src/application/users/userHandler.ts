import Elysia from "elysia";
import { t } from "elysia";
import { jwtVerify } from "jose";
import { userRepository } from "../repositories/userRepository";

function getJwtSecret(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resource } = require("sst");
    if (Resource.AxelSaasJwtSecret?.value) {
      return Resource.AxelSaasJwtSecret.value;
    }
  } catch {
    // Resource not available, fall through to env var
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET is not set. Set it via: sst secret set AxelSaasJwtSecret <secret>",
    );
  }
  return secret;
}

async function getAuthUser(authHeader: string | undefined) {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    return payload as { sub: string; email: string };
  } catch {
    return null;
  }
}

export const userHandler = new Elysia({ name: "UserHandler" })
  .get(
    "/users/me",
    async ({ headers, set }) => {
      // This route requires the supabaseAuth middleware to be applied first
      const authHeader = headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        set.status = 401;
        return { received: false };
      }

      try {
        // Parse token to get sub (would be done by middleware in real app)
        // For now, return empty response as it requires jwt parsing
        set.status = 501;
        return { received: false };
      } catch {
        set.status = 500;
        return { received: false };
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
