# Token Management & Cost Control — Tasks

## Database

- [ ] Add `token_usage` table to `packages/db/src/schema.ts`
- [ ] Add `usage_caps` table to `packages/db/src/schema.ts`
- [ ] Create migration for both tables
- [ ] Seed `usage_caps` with Free and Premium defaults

## Backend — Usage Tracking

- [ ] Create `microservices/core/src/application/usage/` module
- [ ] Create `usageRepository.ts` — record usage, query daily/monthly aggregates
- [ ] Create `usageService.ts` — check usage against caps, return status
- [ ] Implement `recordUsage(userId, model, inputTokens, outputTokens, source)` — upsert daily aggregate
- [ ] Implement `checkUsage(userId, tier)` → `{ allowed: boolean, percentUsed, warning, resetAt }`

## Backend — Usage Enforcement

- [ ] Integrate usage check into chat handler (`chatHandler.ts`) — check before processing, return 429 if over cap
- [ ] Record usage after successful chat response (tokens from gateway response)
- [ ] Add usage warning to response metadata when approaching cap (>80%)
- [ ] Ensure scheduled task execution also checks/records usage

## Backend — Usage API

- [ ] Create `usageHandler.ts` with routes:
  - [ ] `GET /users/me/usage` — current usage + limits + percentage
  - [ ] `GET /users/me/usage/history?days=30` — daily breakdown for charts
- [ ] Mount handler in `api.ts` (protected routes)

## Backend — BYOM Integration

- [ ] When BYOM key is active (check integration_credentials for model provider), skip platform caps
- [ ] Still record usage for visibility (but `allowed` always returns true)
- [ ] Include `byom: true` flag in usage response

## Frontend — Usage Indicator

- [ ] Create `UsageBar` component — percentage bar with label
- [ ] Free tier: show in dashboard sidebar or header area
- [ ] Update on page load and after each chat message
- [ ] Animate smoothly when usage changes

## Frontend — Rate Limit Message

- [ ] Create `RateLimitBanner` component for chat view
- [ ] Show when chat endpoint returns 429
- [ ] Display: limit type, reset time, upgrade CTA (Free) or empathetic message (Premium)
- [ ] Style consistently with chat message bubbles

## Frontend — Usage in Settings

- [ ] Add usage section to Settings → Billing
- [ ] Show current period usage (tokens + % of cap)
- [ ] Show daily usage chart (simple bar chart, last 7/30 days)
- [ ] BYOM users: show estimated cost
- [ ] Fetch from `/users/me/usage` and `/users/me/usage/history`

## OpenClaw Config

- [ ] Update `openclaw-free.json` — set model to `anthropic/haiku`
- [ ] Update `openclaw-premium.json` — set model to `anthropic/sonnet` with haiku secondary
- [ ] Ensure BYOM config override works (handled in integrations spec — verify compatibility)

## Tests

- [ ] Unit tests for usage recording (upsert, daily aggregation)
- [ ] Unit tests for cap checking (under limit, at limit, over limit, approaching warning)
- [ ] Unit tests for BYOM bypass (no cap enforcement when BYOM active)
- [ ] Unit tests for usage handler (current usage, history)
- [ ] Integration test: chat message records usage and enforces cap
- [ ] Frontend tests for UsageBar component (0%, 50%, 80%, 100%)
- [ ] Frontend tests for RateLimitBanner component

## Quality Gates

- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
