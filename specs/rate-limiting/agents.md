# Authenticated Rate Limiting — Agent Instructions

## Context

Only the waitlist has rate limiting. Every authenticated endpoint is unprotected. With a free tier, users could hammer the chat endpoint. This spec adds rate limiting middleware.

## Key Files to Create

| File | Purpose |
|---|---|
| `microservices/core/src/application/middleware/rateLimiter.ts` | Sliding window rate limiter middleware |

## Key Files to Modify

| File | What to change |
|---|---|
| `microservices/core/src/api.ts` | Add global IP rate limit as first middleware |
| `microservices/core/src/application/chat/chatHandler.ts` | Add per-user rate limit |
| `microservices/core/src/application/onboarding/onboardingHandler.ts` | Add per-user rate limit |
| `microservices/core/src/application/subscriptions/subscriptionHandler.ts` | Add per-user rate limit on checkout |

## Existing Rate Limiter

The waitlist handler has its own inline rate limiter. You can reference it for patterns, but create a reusable middleware instead of copying the inline approach.

Check `microservices/core/src/application/waitlist/waitlistHandler.ts` for the existing IP-based implementation.

## Implementation Pattern

```typescript
// rateLimiter.ts
const windows = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(opts: {
  keyFn: (ctx: any) => string;
  windowMs?: number;    // default 60_000
  max?: number;         // default 60
}) {
  const { keyFn, windowMs = 60_000, max = 60 } = opts;
  
  return function rateLimitMiddleware(ctx: any) {
    const key = keyFn(ctx);
    const now = Date.now();
    let win = windows.get(key);
    
    if (!win || now > win.resetAt) {
      win = { count: 0, resetAt: now + windowMs };
      windows.set(key, win);
    }
    
    win.count++;
    
    // Set headers on every response
    ctx.set.headers["X-RateLimit-Limit"] = String(max);
    ctx.set.headers["X-RateLimit-Remaining"] = String(Math.max(0, max - win.count));
    ctx.set.headers["X-RateLimit-Reset"] = String(Math.ceil(win.resetAt / 1000));
    
    if (win.count > max) {
      const retryAfter = Math.ceil((win.resetAt - now) / 1000);
      ctx.set.headers["Retry-After"] = String(retryAfter);
      ctx.set.status = 429;
      return {
        error: "rate_limited",
        message: "Too many requests. Please wait a moment.",
        retryAfter,
      };
    }
  };
}

// Cleanup expired windows every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) {
    if (now > win.resetAt) windows.delete(key);
  }
}, 60_000);
```

## Usage in Handlers

```typescript
// In chatHandler.ts
.onBeforeHandle(rateLimit({
  keyFn: (ctx) => `chat:${getUser(ctx).sub}`,
  max: 10,
  windowMs: 60_000,
}))
```

## Rules

1. **In-memory is fine for MVP.** Lambda warm instances handle burst protection. Cross-instance sharing (Redis) is post-MVP.
2. **Don't rate limit Stripe webhooks.** Stripe controls its own retry/rate behaviour.
3. **Don't rate limit health check.** It needs to always respond.
4. **Headers on every response**, not just 429. Clients can proactively back off.
5. **429 body is JSON**, not HTML. Frontend parses it.
6. **Generous limits.** Normal users should never hit them. 10 chat messages/min is 1 every 6 seconds.

## Testing Notes

- Test: send max+1 requests → last one returns 429
- Test: wait for window to expire → request succeeds again
- Test: different keys don't interfere (user A at limit, user B still allowed)
- Test: response headers are correct at various counts
- Test: cleanup removes expired entries
- Don't test timing-sensitive scenarios with real setTimeout — mock Date.now()
- Coverage threshold: 90%
