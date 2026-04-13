# Tier Alignment — Tasks

## Database & Schema
- [ ] Create migration to update `subscription_tier` enum: remove `starter`, `pro`, `business`, `developer`; add `free`, `premium`, `enterprise`
- [ ] Add data migration: map existing subscriptions (`starter` → `free`, `pro`/`business`/`developer` → `premium`)
- [ ] Update `packages/db/src/schema.ts` with new enum values
- [ ] Run `bun run --filter @axel-saas/db migrate:create` and verify migration

## Backend API
- [ ] Update `microservices/core/src/application/subscriptions/subscriptionHandler.ts` — replace 4-tier TIERS with 3-tier model (free/premium/enterprise)
- [ ] Update `POST /subscriptions/checkout` to accept only `premium` as tierId
- [ ] Update `GET /subscriptions/tiers` response to return new tier list
- [ ] Update `microservices/core/src/application/stripe/stripeHandler.ts` — webhook maps to `premium` tier
- [ ] Replace 4 Stripe price env vars with single `STRIPE_PRICE_PREMIUM` in handler
- [ ] Update `infra/api.ts` — bind single `STRIPE_PRICE_PREMIUM` env var
- [ ] Update `infra/secrets.ts` if Stripe price is managed as SST secret
- [ ] Update `microservices/core/src/application/subscriptions/CLAUDE.md` module docs

## Workspace Templates
- [ ] Create `docker/user-container/workspace-templates/openclaw-free.json` (cheap model, usage caps)
- [ ] Create `docker/user-container/workspace-templates/openclaw-premium.json` (stronger model, higher limits)
- [ ] Remove old tier configs: `openclaw-starter.json`, `openclaw-pro.json`, `openclaw-business.json`, `openclaw-developer.json`
- [ ] Update `docker-entrypoint.sh` tier placeholder injection for `free` / `premium`
- [ ] Update workspace generator (`microservices/core/src/application/workspace/workspaceGenerator.ts`) tier references

## Frontend
- [ ] Rewrite `packages/web/src/pages/planRecommendation.ts` — 3 plans (Free/Premium/Enterprise), simplified recommendation
- [ ] Update `packages/web/src/pages/chat/DiscoveryPanel.tsx` — 3-card layout
- [ ] Update `packages/web/src/pages/subscribeApi.ts` — send `tier: "premium"` only
- [ ] Update `packages/web/src/pages/ChatContainer.tsx` — discovery mode uses new plans
- [ ] Update `packages/web/src/pages/Settings.tsx` — pull real tier from API (not hardcoded)
- [ ] Verify `packages/web/src/pages/publicPricing.ts` still correct (should be fine)
- [ ] Verify `packages/web/src/pages/Pricing.tsx` still correct

## Tests
- [ ] Update subscription handler tests for new tier IDs
- [ ] Update Stripe webhook tests for `premium` mapping
- [ ] Update plan recommendation tests for 3-tier model
- [ ] Update discovery panel tests
- [ ] Run full test suite: `bun run test:unit` — verify 90% coverage maintained

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
