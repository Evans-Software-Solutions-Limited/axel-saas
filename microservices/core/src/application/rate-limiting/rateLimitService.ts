/**
 * Per-user rate-limit gate. Called explicitly from each protected
 * handler after the user/subscription has been resolved — same shape
 * as the token-cap check in `chatHandler.ts`.
 *
 * Returns a structured `{allowed, retryAfter, limit, remaining, reset}`
 * shape so the handler can set `Retry-After` + `X-RateLimit-*`
 * headers on the 429 response.
 */

import {
  BUCKET_TTL_SECONDS,
  WINDOW_SECONDS,
  getRateLimit,
  type RateLimitCategory,
} from "./rateLimitConfig";
import { DynamoRateLimitClient, type RateLimitClient } from "./rateLimitClient";
import type { SubscriptionTier } from "../integrations/tierGate";

export interface RateLimitDecision {
  allowed: boolean;
  /** Per-minute quota for the (category, tier) pair. */
  limit: number;
  /**
   * Approximate remaining quota in this window after this call. When
   * blocked it's 0; when allowed it's `limit - count` (the count
   * returned by the DDB increment).
   */
  remaining: number;
  /** Epoch seconds when the current window ends. */
  resetAt: number;
  /**
   * Seconds the caller should wait before retrying. Always ≥ 1 even
   * inside the same second so a 429 response always produces a
   * meaningful `Retry-After` header.
   */
  retryAfter: number;
}

export class RateLimitService {
  private readonly client: RateLimitClient;
  private readonly now: () => Date;

  constructor(deps: { client?: RateLimitClient; now?: () => Date } = {}) {
    this.client = deps.client ?? new DynamoRateLimitClient();
    this.now = deps.now ?? (() => new Date());
  }

  async checkAndConsume(input: {
    userId: string;
    category: RateLimitCategory;
    tier: SubscriptionTier | null;
  }): Promise<RateLimitDecision> {
    const limit = getRateLimit(input.category, input.tier);
    const nowSec = Math.floor(this.now().getTime() / 1000);
    const windowStart = nowSec - (nowSec % WINDOW_SECONDS);
    const windowEnd = windowStart + WINDOW_SECONDS;

    const bucketKey = `${input.userId}#${input.category}#${windowStart}`;
    const ttlSeconds = windowStart + BUCKET_TTL_SECONDS;

    const result = await this.client.incrementAndCheck({
      bucketKey,
      limit,
      ttlSeconds,
    });

    const remaining = result.allowed ? Math.max(0, limit - result.count) : 0;
    const retryAfter = Math.max(1, windowEnd - nowSec);

    return {
      allowed: result.allowed,
      limit,
      remaining,
      resetAt: windowEnd,
      retryAfter,
    };
  }
}
