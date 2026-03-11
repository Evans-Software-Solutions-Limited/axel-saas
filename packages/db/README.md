# `@axel-saas/db`

## Migration Workflow

This package uses Drizzle's generated migration flow for staging and production.

- Generate a schema migration: `bun run --filter @axel-saas/db db:generate --name your_change`
- Generate a custom SQL migration: `bun run --filter @axel-saas/db db:generate:custom --name your_change`
- Apply committed migrations: `bun run --filter @axel-saas/db db:migrate`

Commit all generated artifacts under `packages/db/migrations/`:

- the new `*.sql` migration file
- `migrations/meta/_journal.json`
- any new `migrations/meta/*_snapshot.json` files

Notes:

- `db:generate` does not require `DATABASE_URL`
- `db:migrate` does require `DATABASE_URL`
- Do not use `db:push` for staging or production deploys
