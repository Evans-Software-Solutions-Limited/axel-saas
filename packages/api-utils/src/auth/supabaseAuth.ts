import { createRemoteJWKSet, jwtVerify } from "jose";

// Supabase JWT payload shape
export type SupabaseUser = {
  sub: string; // user UUID
  email: string;
  email_verified: boolean;
  iat: number;
  exp: number;
};

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

/**
 * Verify a Supabase JWT and return the decoded user, or null if invalid.
 * Use this in a handler's `derive` to inject the user into context.
 */
export async function getAuthUser(
  authHeader: string | undefined,
): Promise<SupabaseUser | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, getJwks());
    return payload as SupabaseUser;
  } catch (err) {
    console.error("[supabaseAuth] JWT verification failed:", err);
    return null;
  }
}

/**
 * Drop into a handler's `onBeforeHandle` to reject unauthenticated requests.
 * Returning a value from `onBeforeHandle` stops the Elysia pipeline.
 *
 * Usage in each protected handler:
 *   .derive(async ({ headers }) => ({ user: await getAuthUser(headers.authorization) }))
 *   .onBeforeHandle(requireAuth)
 */
export function requireAuth({
  user,
  set,
}: {
  user: SupabaseUser | null;
  set: { status?: number | string };
}) {
  if (!user) {
    set.status = 401;
    return { success: false, error: "Unauthorized" };
  }
}

/**
 * Retrieve the verified Supabase user from the Elysia handler context.
 * Elysia's derive types don't propagate across package boundaries, so use
 * this helper instead of destructuring `user` directly from ctx.
 */
export function getUser(ctx: object): SupabaseUser {
  return (ctx as { user: SupabaseUser }).user;
}
