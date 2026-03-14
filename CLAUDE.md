# CLAUDE.md – Axel SaaS

## What This Repo Is

A full-stack AI PA/copilot SaaS product built with Bun, SST v3, TypeScript. Monorepo with React frontend, Elysia backend, and Drizzle database layer. Stripe subscription handling with Supabase auth.

The product: OpenClaw-as-a-Service. Axel (the AI) available to non-technical users. Multi-tier subscriptions (Starter, Pro, Business, Developer).

## Architecture

- **Frontend:** React (packages/web), React Router, Vite. Pages, context, components, hooks. Container/Presenter pattern where complex.
- **Backend:** Elysia (microservices/core). Route handlers with Supabase auth middleware. Separated into modules: users, subscriptions, stripe, onboarding, chat, workspace.
- **Database:** Drizzle ORM (packages/db). Migrations versioned. Supabase as data source.
- **Infra:** SST v3 with sst.config.ts, resource split across infra/ (api.ts, storage.ts, etc).
- **Package Manager:** Bun 1.3.9+, Workspaces, Turborepo for task orchestration.

Auth flow: Supabase JWT → Elysia middleware (`requireAuth`, `getAuthUser`) → route handler context.

## Key Directories

| Path | Purpose |
|------|---------|
| `microservices/core/src/application/` | Business logic: handlers, repositories, domain modules |
| `microservices/core/src/application/stripe/` | Stripe webhooks & event handling |
| `microservices/core/src/application/subscriptions/` | Subscription tiers, checkout, billing state |
| `packages/web/src/pages/` | Page-level components (Chat, Settings, Integrations, Crons, Tasks) |
| `packages/web/src/components/` | Reusable UI components |
| `packages/db/src/schema.ts` | Drizzle schema definitions |
| `packages/db/migrations/` | SQL migrations (version numbered, meta journal) |
| `infra/` | SST resource definitions (API, storage, auth) |

## Standards

### Code Quality
- **Typecheck:** `bun run typecheck` (turbo → all packages)
- **Lint:** `bun run lint` (eslint via turbo)
- **Format:** `bun run prettier:check` / `--write` (enforce via CI)
- **Build:** `bun run build` (turbo, must succeed for each package)
- **Tests:** `bun run test:unit` (Vitest via turbo)

### Testing Rules
- **Coverage threshold:** 90% (lines, functions, branches, statements) — non-negotiable
- **No fake tests.** No skips, no coverage exclusions added by agents. Tests must prove behaviour.
- **Coverage includes:** `src/application/**/*.ts` and `src/**/repositories/*.ts`
- **Excluded from coverage:** Elysia handler files (complex middleware, tested via repo/utility tests), index/api files, type defs, `.d.ts`
- **Test structure:** Colocate tests (`__tests__/` directory), one test file per module

### Elysia Routes
- Routes defined as modules (subscribe, mount in api.ts)
- Auth: derive user context + `requireAuth` guard, then use `getUser(ctx)` in handler
- Stripe: unsigned webhook route (Stripe signs the payload)
- Public vs protected routes clearly separated (e.g. `subscriptionPublicHandler` vs `subscriptionHandler`)
- Type guards: `t.Object({...})` for request body schema

### Frontend
- Pages are containers (logic, state, API calls)
- Components are presenters (props only, no hooks)
- Context for global state (auth, user profile)
- Tests: component rendering, user interactions, API call mocking

### Database Migrations
- **Create:** `bun run --filter @axel-saas/db migrate:create`
- **Apply:** `bun run --filter @axel-saas/db migrate:up`
- Each migration in `packages/db/migrations/` (SQL + meta JSON snapshot)
- Schema in `packages/db/src/schema.ts` (Drizzle definitions)

## Commands Before Claiming Done

```bash
bun run prettier:check  # format check
bun run typecheck       # TypeScript
bun run lint           # ESLint
bun run build          # build all packages
bun run test:unit      # Vitest (must hit 90% coverage)
```

If any fail, fix it. No exceptions.

## Dangerous Areas

### Stripe Payments
- **File:** `microservices/core/src/application/stripe/stripeHandler.ts`
- **Risk:** Unsigned webhooks, state sync, idempotency
- **Rules:**
  - Webhook signature validation (Stripe signing key)
  - Idempotent event processing (same event ID = same result)
  - Webhook must update subscription state and user tier atomically
  - Do not assume webhook order — handle out-of-order events
  - Test webhook replay scenarios

### Subscriptions & Billing
- **File:** `microservices/core/src/application/subscriptions/`
- **Risk:** Double-charging, tier downgrades losing features, payment state mismatch
- **Rules:**
  - Subscription state transitions must be explicit (pending → active → cancelled)
  - Checkout session must link to Stripe payment intent
  - Feature access gated by current tier in both backend and frontend
  - Cancellation must revoke access immediately (use TTL/expiry fields, not hard deletes)

### Auth & Access Control
- **File:** `packages/api-utils/auth/supabaseAuth.ts` + route handlers
- **Risk:** Auth bypass, privilege escalation, cross-user data access
- **Rules:**
  - `requireAuth` must be called on every protected route (no exceptions)
  - Row-level security (RLS) on Supabase tables — verify before writing queries
  - User ID from JWT token — do not trust `userId` from request body
  - Tests must cover unauthorized access (missing token, invalid token, wrong user)

## Current Priorities

1. **Stripe checkout integration** – subscriptions/checkout endpoint currently mocked
2. **Webhook event handling** – Stripe events → subscription state sync
3. **Feature gating** – tier-based access control across frontend + backend
4. **Chat & onboarding flows** – recently refactored, needs e2e test coverage
5. **Database migration stability** – ensure migrations are idempotent and reversible

## PR Checklist

- [ ] All checks pass (prettier, typecheck, lint, build, test)
- [ ] Coverage ≥ 90% on changed files
- [ ] No fake tests added
- [ ] If touching Stripe/subscriptions/auth: code review from domain owner
- [ ] If adding migrations: migration reversal tested
- [ ] Commit message: conventional (feat/, fix/, chore/)
