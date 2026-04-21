# Authenticated Rate Limiting — Design

## Overview

Only the waitlist endpoint has rate limiting (IP-based, 10 req/min). Every authenticated endpoint is unprotected. With a free tier, this is a risk — a user could hammer the chat endpoint, burn through token budgets via rapid fire, or abuse the API.

Token usage caps (from token-management spec) limit **cost**, but rate limiting limits **throughput** — both are needed.

## Strategy

### Layered Rate Limiting

| Layer            | What it protects      | Key                | Limits             |
| ---------------- | --------------------- | ------------------ | ------------------ |
| **Global**       | Entire API from abuse | IP address         | 100 req/min per IP |
| **Per-user**     | Individual endpoints  | User ID            | Varies by endpoint |
| **Per-endpoint** | Expensive operations  | User ID + endpoint | Tighter limits     |

### Per-Endpoint Limits

| Endpoint                       | Free Tier | Premium Tier | Rationale                   |
| ------------------------------ | --------- | ------------ | --------------------------- |
| POST /users/chat/message       | 10/min    | 30/min       | Most expensive (token cost) |
| POST /users/onboarding/message | 10/min    | 10/min       | Same for all tiers          |
| GET /users/me/tasks            | 30/min    | 60/min       | Read-only but still DB cost |
| POST /subscriptions/checkout   | 3/min     | 3/min        | Stripe rate protection      |
| POST /integrations/\*/connect  | 5/min     | 5/min        | Credential operations       |
| POST /users/me/schedules       | 10/min    | 20/min       | Write operations            |
| GET \* (other reads)           | 60/min    | 120/min      | General read ceiling        |
| POST /stripe/webhook           | No limit  | No limit     | Stripe controls this        |

### Chat Endpoint Special Case

The chat endpoint is the most expensive because every request triggers AI inference. Rate limiting here works **alongside** token usage caps:

- **Rate limit** prevents burst abuse (10 messages/minute)
- **Token cap** prevents total cost overrun (50K tokens/day free)

A user who sends 10 messages in 1 minute might use 5K tokens and get rate-limited. They still have 45K tokens left for the day but need to wait before the next message.

## Implementation

### Storage Backend

**MVP: In-memory** (same as existing waitlist rate limiter)

```typescript
// Simple sliding window counter
const windows = new Map<string, { count: number; resetAt: number }>();
```

**Pros:** Zero infrastructure, fast, simple
**Cons:** Per-Lambda-instance (not shared across invocations), resets on cold start

**This is acceptable for MVP.** Lambda instances handle multiple requests during their warm period. The rate limiter protects against burst abuse within a single instance. Cross-instance abuse is a post-MVP concern (use Redis/DynamoDB then).

### Middleware Pattern

```typescript
// microservices/core/src/application/middleware/rateLimiter.ts

interface RateLimitConfig {
  key: (ctx: Context) => string; // e.g. userId, IP, or userId+endpoint
  windowMs: number; // Window size (e.g. 60000 for 1 minute)
  maxRequests: number; // Max requests per window
}

function rateLimit(config: RateLimitConfig) {
  return (ctx: Context) => {
    const key = config.key(ctx);
    const now = Date.now();
    const window = windows.get(key);

    if (!window || now > window.resetAt) {
      windows.set(key, { count: 1, resetAt: now + config.windowMs });
      return; // Allowed
    }

    if (window.count >= config.maxRequests) {
      ctx.set.status = 429;
      return {
        error: "rate_limited",
        message: "Too many requests. Please wait a moment.",
        retryAfter: Math.ceil((window.resetAt - now) / 1000),
      };
    }

    window.count++;
  };
}
```

### Elysia Integration

Apply as `onBeforeHandle` middleware:

```typescript
// Per-handler rate limiting
const chatHandler = new Elysia()
  .derive(/* auth */)
  .onBeforeHandle(requireAuth)
  .onBeforeHandle(
    rateLimit({
      key: (ctx) => `chat:${getUser(ctx).sub}`,
      windowMs: 60_000,
      maxRequests: (ctx) => (getUserTier(ctx) === "free" ? 10 : 30),
    }),
  )
  .post("/users/chat/message" /* ... */);
```

### Tier-Aware Limits

The rate limiter needs to know the user's tier to apply the right limit. Options:

1. **Fetch tier in the rate limiter** — adds a DB call (expensive)
2. **Pass tier from auth middleware** — the auth `derive` already fetches user data, tier can be included
3. **Use a fixed conservative limit** — same for all tiers (simplest)

**MVP recommendation:** Option 3 — use a single limit per endpoint. Tier-differentiated limits add complexity with minimal benefit at launch. Revisit when Free tier abuse is observed.

## Response Headers

Include standard rate limit headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1681234567 (Unix timestamp)
Retry-After: 12 (seconds, on 429 only)
```

## Frontend Handling

When the frontend receives 429:

- Chat: show "Slow down — Axel needs a moment" inline message (not a browser error)
- Other endpoints: show toast notification with retry suggestion
- Respect `Retry-After` header before retrying

## Memory Cleanup

In-memory rate limit windows accumulate. Clean up expired entries periodically:

```typescript
setInterval(() => {
  const now = Date.now();
  for (const [key, window] of windows) {
    if (now > window.resetAt) windows.delete(key);
  }
}, 60_000); // Clean up every minute
```
