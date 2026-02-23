import Elysia from "elysia";

export const userHandler = new Elysia({ name: "UserHandler" }).get(
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
);
