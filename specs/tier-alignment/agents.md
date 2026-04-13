# Tier Alignment — Agent Instructions

## Context

You are working on collapsing a 4-tier subscription model (Starter/Pro/Business/Developer) into a 3-tier model (Free/Premium/Enterprise). The public pricing page at `packages/web/src/pages/publicPricing.ts` is the source of truth for tier names and prices.

## Key Files

| File                                                                      | What to change                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/db/src/schema.ts`                                               | Update `subscription_tier` enum                |
| `packages/db/migrations/`                                                 | New migration for enum change + data migration |
| `microservices/core/src/application/subscriptions/subscriptionHandler.ts` | Replace TIERS array, update checkout logic     |
| `microservices/core/src/application/stripe/stripeHandler.ts`              | Update webhook tier mapping                    |
| `microservices/core/src/application/workspace/workspaceGenerator.ts`      | Update tier references                         |
| `infra/api.ts`                                                            | Replace 4 Stripe price env vars with 1         |
| `packages/web/src/pages/planRecommendation.ts`                            | Rewrite PLANS array and keyword matching       |
| `packages/web/src/pages/chat/DiscoveryPanel.tsx`                          | 3-card layout                                  |
| `packages/web/src/pages/subscribeApi.ts`                                  | Simplify to single tier                        |
| `packages/web/src/pages/Settings.tsx`                                     | Wire billing to real API data                  |
| `docker/user-container/workspace-templates/`                              | Replace 4 tier configs with 2                  |

## Rules

1. **Do not break Stripe webhooks.** The webhook handler must still process existing events. Use `upsert` patterns.
2. **Migration must be safe.** Existing data must map cleanly. No data loss.
3. **Free tier gets a real agent.** Free is not a demo — it's a usage-capped real experience.
4. **Enterprise has no checkout.** `tierId: null` in the frontend, `enterprise` in the DB for manual provisioning only.
5. **Single Stripe price.** Only `STRIPE_PRICE_PREMIUM` exists. Remove all references to `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_DEVELOPER`.
6. **Run all quality gates** before marking done: prettier, typecheck, lint, build, test.

## Order of Operations

1. Schema migration first (DB must accept new values)
2. Backend handlers (API must serve new tiers)
3. Workspace templates (provisioning must use new configs)
4. Frontend (UI must reflect new model)
5. Tests last (verify everything)

## Testing Notes

- Existing subscription handler tests are in `__tests__/` directories colocated with handlers
- Coverage threshold is 90% — do not let it drop
- Test both the migration path (old data → new) and fresh creation
