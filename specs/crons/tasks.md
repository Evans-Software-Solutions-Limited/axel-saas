# Crons & Schedules — Tasks

## Database
- [ ] Add `schedules` table to `packages/db/src/schema.ts`
- [ ] Create migration for `schedules` table
- [ ] Add index on `user_id`

## Backend
- [ ] Create `microservices/core/src/application/schedules/` module
- [ ] Create `scheduleRepository.ts` — CRUD for schedules
- [ ] Create `scheduleHandler.ts` with routes:
  - [ ] `GET /users/me/schedules` — list user's schedules
  - [ ] `POST /users/me/schedules` — create schedule (validate cron expression)
  - [ ] `PUT /users/me/schedules/:id` — update schedule
  - [ ] `DELETE /users/me/schedules/:id` — delete schedule
  - [ ] `POST /users/me/schedules/:id/run` — trigger immediate execution
- [ ] Mount handler in `api.ts` (protected routes)
- [ ] Implement cron expression validation (use a library like `cron-parser`)
- [ ] Implement `nextRunAt` calculation from cron expression + timezone
- [ ] Implement workspace propagation: write schedules to HEARTBEAT.md / openclaw config

## Frontend — API Client
- [ ] Create `packages/web/src/pages/crons/schedulesApi.ts` — eden client calls

## Frontend — Schedule List
- [ ] Rewrite `packages/web/src/pages/Crons.tsx` — replace hardcoded SCHEDULES with API data
- [ ] Show: name, human-readable frequency, last run status, next run time, enabled toggle
- [ ] Implement enable/disable toggle (calls PUT with `{ enabled: true/false }`)
- [ ] Add "Run now" button per schedule
- [ ] Add overflow menu (⋮) with Edit and Delete options
- [ ] Add "+ New" button in page header
- [ ] Add loading skeleton
- [ ] Add empty state with CTA

## Frontend — Create/Edit Modal
- [ ] Create `ScheduleFormModal` component
- [ ] Preset frequency selector: Daily, Weekday, Weekly, Hourly, Custom
- [ ] Time picker for scheduled time
- [ ] Timezone selector (default to browser timezone)
- [ ] Description textarea (what Axel should do)
- [ ] Advanced toggle to show raw cron expression input
- [ ] Validate inputs before submit
- [ ] Pre-fill values for edit mode

## Frontend — Delete Confirmation
- [ ] Create confirmation dialog for schedule deletion
- [ ] Show schedule name in confirmation

## Frontend — Execution History Link
- [ ] "View history" links to Tasks page filtered by schedule source

## Tests
- [ ] Unit tests for cron expression validation
- [ ] Unit tests for nextRunAt calculation
- [ ] Unit tests for schedule repository CRUD
- [ ] Unit tests for schedule handler (create, update, delete, toggle, run)
- [ ] Frontend tests for schedule list rendering
- [ ] Frontend tests for create/edit modal form validation
- [ ] Frontend tests for enable/disable toggle
- [ ] Frontend tests for empty state

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
