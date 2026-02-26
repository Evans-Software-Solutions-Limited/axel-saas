import { Elysia } from "elysia";
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

// Elysia plugin — attaches `user` to context on all routes that use it
export const supabaseAuth = new Elysia({ name: "SupabaseAuth" }).derive(
  async ({ headers, set }) => {
    const authHeader = headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      set.status = 401;
      throw new Error("Missing or invalid Authorization header");
    }
    const token = authHeader.slice(7);
    try {
      const { payload } = await jwtVerify(token, getJwks());
      return { user: payload as unknown as SupabaseUser };
    } catch (err) {
      console.error("[supabaseAuth] JWT verification failed:", err);
      set.status = 401;
      throw new Error("Invalid or expired token");
    }
  },
);
