/**
 * Sets the standard `X-RateLimit-Limit / -Remaining / -Reset` headers
 * (and `Retry-After` when blocked) on the Elysia response context.
 *
 * Pulled out of the handlers so every protected route emits the same
 * shape — frontend toast / banner code can pattern-match on
 * `Retry-After` without per-route conditionals.
 *
 * Spec reference: `specs/rate-limiting/requirements.md` US-RL2.
 */

import type { RateLimitDecision } from "./rateLimitService";

/**
 * Permissive shape for what we need from a context to emit headers —
 * just enough to read/write `set.headers`. Elysia's actual `set.headers`
 * is a branded `HTTPHeaders` type that resists structural assignment
 * from a plain object literal; we mutate it in place instead of
 * reassigning the slot, and accept any context whose `set` exposes a
 * headers bag we can index into.
 */
export interface RateLimitHeadersTarget {
  set: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    headers?: any;
  };
}

export function applyRateLimitHeaders(
  target: RateLimitHeadersTarget,
  decision: RateLimitDecision,
): void {
  // Lazily initialise the headers bag, then write each header by
  // direct property assignment — that avoids the structural assignment
  // failure of `target.set.headers = { ...spread, ...new }`.
  if (!target.set.headers) target.set.headers = {};
  const headers = target.set.headers as Record<string, string | undefined>;
  headers["X-RateLimit-Limit"] = String(decision.limit);
  headers["X-RateLimit-Remaining"] = String(decision.remaining);
  headers["X-RateLimit-Reset"] = String(decision.resetAt);
  if (!decision.allowed) {
    headers["Retry-After"] = String(decision.retryAfter);
  }
}

/**
 * Standard 429 body shape — kept consistent across handlers so the
 * frontend can render a uniform "slow down" toast / banner.
 */
export interface RateLimitBlockedBody {
  success: false;
  error: "rate_limited";
  message: string;
  retryAfter: number;
}

export function buildRateLimitedBody(
  decision: RateLimitDecision,
  message: string,
): RateLimitBlockedBody {
  return {
    success: false,
    error: "rate_limited",
    message,
    retryAfter: decision.retryAfter,
  };
}
