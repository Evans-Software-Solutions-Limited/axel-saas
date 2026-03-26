# Waitlist Implementation Tasks

Reference: [waitlist-api-spec.md](./waitlist-api-spec.md)

---

## Database

- [ ] Add `waitlist` table migration (`packages/db/migrations/`)
  - Fields: `id`, `email` (unique), `interestedIn` (enum), `token` (unique), `confirmedAt`, `updatedAt`
- [ ] Add Drizzle schema definition in `packages/db/src/schema.ts`

## Backend

- [ ] Create `WaitlistRepository` in `microservices/core/src/application/waitlist/waitlistRepository.ts`
  - `upsertByEmail(email, interestedIn)` → returns `{ record, isNew }`
  - `deleteByToken(token)` → throws `NotFoundError` if missing
- [ ] Create route module `microservices/core/src/application/waitlist/waitlistHandler.ts`
  - `POST /waitlist` — validate body, call repo, trigger email, return `201`/`200`
  - `DELETE /waitlist/unsubscribe` — query param `token`, call repo, return `200`
- [ ] Mount waitlist routes in `microservices/core/src/api.ts` (public, no auth)
- [ ] Add request body schema (`t.Object`) with `interestedIn` enum guard
- [ ] Add IP-based rate limiting on `POST /waitlist`

## Email

- [ ] Create email templates (join confirmation, update confirmation)
  - Both must include the unsubscribe link footer
- [ ] Wire `sendJoinConfirmation(email, interestedIn, token)` after new signup
- [ ] Wire `sendUpdateConfirmation(email, interestedIn, token)` after tier update
- [ ] Ensure emails are sent async (do not block the HTTP response)

## Tests

- [ ] `waitlistRepository.test.ts` — upsert (new), upsert (existing/update), deleteByToken (found), deleteByToken (missing)
- [ ] `waitlistHandler.test.ts` — happy path join, happy path update, unsubscribe, invalid `interestedIn`, missing fields, invalid email, unknown token
- [ ] Coverage ≥ 90% on repository and handler

## Infra / Config

- [ ] Add email provider env vars (if not already present)
- [ ] Confirm `waitlist` table is excluded from RLS (public writes, no user context)

## Done criteria

- All repo checks pass: `prettier:check`, `typecheck`, `lint`, `build`, `test:unit`
- No auth required on any waitlist endpoint
- Token never returned in HTTP responses — only in emails
