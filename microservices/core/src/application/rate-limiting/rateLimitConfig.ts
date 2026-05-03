/**
 * Per-tier × per-category rate-limit configuration.
 *
 * Routes are grouped into three categories:
 *  - `chat`  — AI inference paths (chat + onboarding). Cost-heavy; lowest
 *              quota. Token caps (`tokenBudgets.ts`) cover total spend;
 *              this caps burst frequency.
 *  - `write` — credential and account mutations (integrations connect /
 *              revoke / oauth-start, future settings writes). Tight
 *              ceilings — these endpoints are rarely high-frequency in
 *              normal use, and protecting them shields the secret store
 *              and Stripe API from abuse.
 *  - `read`  — GETs the frontend polls or fetches on navigation. Higher
 *              ceilings so a normal user never hits them.
 *
 * Limits sourced from `specs/rate-limiting/design.md` (Free/Premium
 * columns); Enterprise inherits Premium values for v1 — Enterprise users
 * still need protection from runaway clients.
 *
 * Window is fixed: 60 seconds. The bucket is keyed on the minute the
 * request arrives in (UTC), so a "10 req/min" limit means "at most 10
 * requests in any UTC minute". Simple to reason about and matches the
 * existing waitlist limiter.
 */

import type { SubscriptionTier } from "../integrations/tierGate";

export type RateLimitCategory = "chat" | "write" | "read";

export const WINDOW_SECONDS = 60;

/**
 * TTL applied to each bucket row in DynamoDB. Set just past the end of
 * the window so DDB cleans up stale rows automatically — no separate
 * sweeper. The 30s margin covers DDB's eventual-consistency on TTL
 * deletion (which can lag by minutes; this guards against a bucket that
 * survives one window from being mistaken for the next).
 */
export const BUCKET_TTL_SECONDS = WINDOW_SECONDS + 30;

interface CategoryLimits {
  free: number;
  premium: number;
  enterprise: number;
}

const LIMITS: Record<RateLimitCategory, CategoryLimits> = {
  // POST /users/chat/message, POST /users/onboarding/message
  chat: { free: 10, premium: 30, enterprise: 30 },
  // POST /integrations/:id/connect|revoke|oauth/start, future writes
  write: { free: 5, premium: 5, enterprise: 5 },
  // GET /users/me/usage, GET /users/me/agent, GET /users/me/tasks, etc.
  read: { free: 60, premium: 120, enterprise: 120 },
};

/**
 * Resolve the per-minute request limit for a (category, tier) pair.
 * Tier=null (no subscription row yet, e.g. mid-signup) is treated as
 * Free — same defensive default as the token-management gate.
 */
export function getRateLimit(
  category: RateLimitCategory,
  tier: SubscriptionTier | null,
): number {
  const tierKey: keyof CategoryLimits =
    tier === "premium" || tier === "enterprise" ? tier : "free";
  return LIMITS[category][tierKey];
}
