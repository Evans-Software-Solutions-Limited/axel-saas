# Authenticated Rate Limiting — Tasks

## Core Middleware
- [ ] Create `microservices/core/src/application/middleware/rateLimiter.ts` — sliding window rate limiter
- [ ] Implement in-memory window store with cleanup interval
- [ ] Return 429 with JSON body (error, message, retryAfter) and standard headers
- [ ] Support configurable key function, window size, and max requests

## Global Rate Limit
- [ ] Add IP-based global rate limit (100 req/min) as first middleware in `api.ts`
- [ ] Apply before authentication (catches pre-auth abuse)

## Per-Endpoint Rate Limits
- [ ] Chat message: 10 req/min per user — `chatHandler.ts`
- [ ] Onboarding message: 10 req/min per user — `onboardingHandler.ts`
- [ ] Subscription checkout: 3 req/min per user — `subscriptionHandler.ts`
- [ ] Integration connect/disconnect: 5 req/min per user — integration handler
- [ ] Schedule CRUD: 10 req/min per user — schedule handler
- [ ] General reads: 60 req/min per user — apply as default on protected routes

## Response Headers
- [ ] Add `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` to all responses (not just 429)
- [ ] Add `Retry-After` header on 429 responses

## Frontend Handling
- [ ] Chat: show inline "Slow down" message on 429 (reuse RateLimitBanner from token-management spec)
- [ ] Other endpoints: show toast notification
- [ ] Respect Retry-After header before auto-retry (if any retry logic exists)

## Memory Management
- [ ] Add cleanup interval (every 60s) to remove expired windows
- [ ] Ensure cleanup doesn't block event loop (it won't — just Map iteration)

## Tests
- [ ] Unit tests for rate limiter: under limit → allowed, at limit → 429, after reset → allowed
- [ ] Unit tests for key function (per-user, per-IP, per-user+endpoint)
- [ ] Unit tests for response headers (correct values)
- [ ] Unit tests for memory cleanup (expired entries removed)
- [ ] Integration test: apply to chat handler, verify 11th request in 1 minute returns 429

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
