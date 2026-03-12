# `@axel-saas/db`

## Migration Workflow

This package uses Drizzle's generated migration flow for staging and production.

- Generate a schema migration: `bun run --filter @axel-saas/db db:generate --name your_change`
- Generate a custom SQL migration: `bun run --filter @axel-saas/db db:generate:custom --name your_change`
- Apply committed migrations (with baseline support): `bun run --filter @axel-saas/db db:migrate`
- Apply raw Drizzle migrations without baseline handling: `bun run --filter @axel-saas/db db:migrate:raw`
- Mark an existing schema as already having applied a migration prefix: `DRIZZLE_BASELINE_TAG=0001_auth_user_trigger bun run --filter @axel-saas/db db:baseline`

Commit all generated artifacts under `packages/db/migrations/`:

- the new `*.sql` migration file
- `migrations/meta/_journal.json`
- any new `migrations/meta/*_snapshot.json` files

Notes:

- `db:generate` does not require `DATABASE_URL`
- `db:migrate` does require `DATABASE_URL`
- Do not use `db:push` for staging or production deploys
- If a Supabase environment already has schema objects but is missing Drizzle bookkeeping, run `db:baseline` once with the latest migration tag that already exists there. Then use `db:migrate` normally.
- For the current staging database, baseline through `0001_auth_user_trigger` before applying `0002_onboarding_state`.
