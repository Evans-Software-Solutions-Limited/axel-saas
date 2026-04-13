# Crons & Schedules — Agent Instructions

## Context

The Crons page lets users create and manage recurring automated tasks. OpenClaw has built-in cron support. The Axel SaaS frontend provides a management UI; the schedules get propagated to the user's OpenClaw workspace.

## Key Files to Create

| File                                                                 | Purpose                                 |
| -------------------------------------------------------------------- | --------------------------------------- |
| `packages/db/src/schema.ts`                                          | Add `schedules` table (modify existing) |
| `microservices/core/src/application/schedules/scheduleHandler.ts`    | Elysia route handler                    |
| `microservices/core/src/application/schedules/scheduleRepository.ts` | DB access                               |
| `packages/web/src/pages/Crons.tsx`                                   | Rewrite existing page                   |
| `packages/web/src/pages/crons/schedulesApi.ts`                       | API client                              |
| `packages/web/src/pages/crons/ScheduleFormModal.tsx`                 | Create/edit modal                       |

## Key Files to Modify

| File                            | What to change         |
| ------------------------------- | ---------------------- |
| `microservices/core/src/api.ts` | Mount schedule handler |

## Cron Expression Handling

Use `cron-parser` (or similar) for:

1. Validating cron expressions
2. Calculating `nextRunAt` from expression + timezone
3. Generating human-readable descriptions

**Do not write a custom cron parser.** Use a library.

## Friendly Presets

Non-technical users should never need to write raw cron. Offer these presets:

```typescript
const PRESETS = [
  { label: "Every day", template: "0 {H} * * *" },
  { label: "Every weekday", template: "0 {H} * * 1-5" },
  { label: "Every Monday", template: "0 {H} * * 1" },
  { label: "Every hour", template: "0 * * * *" },
  { label: "Every 6 hours", template: "0 */6 * * *" },
];
```

Let users pick a preset + time. Show raw cron under an "Advanced" toggle for power users.

## Workspace Propagation

When a schedule changes, update the user's workspace:

1. Regenerate `HEARTBEAT.md` with all active schedules listed
2. Each schedule entry in HEARTBEAT.md should describe what to do in natural language

Example HEARTBEAT.md content:

```markdown
# HEARTBEAT.md

## Scheduled Tasks

- **Daily email digest** (every day at 09:00 UTC+1): Check inbox and send a summary of important emails
- **Weekly report** (every Monday at 14:00 UTC+1): Generate and send the weekly activity report
```

OpenClaw reads HEARTBEAT.md during heartbeat check-ins and acts on the listed tasks.

## Rules

1. **Validate cron expressions server-side.** Don't trust frontend validation alone.
2. **Timezone is mandatory.** Default to UTC but let users set their timezone.
3. **nextRunAt must be recalculated** on create, update, enable, and after each run.
4. **Immediate "Run now" creates a task** via the existing task system — don't bypass it.
5. **Deleting a schedule preserves task history.** Old executions remain in the tasks table.
6. **Disabled schedules are not deleted from workspace** — they're commented out or removed from HEARTBEAT.md.

## Testing Notes

- Test cron expression validation (valid, invalid, edge cases)
- Test nextRunAt calculation across timezones
- Test create/read/update/delete repository operations
- Test handler auth (must require authentication)
- Test workspace propagation writes correct HEARTBEAT.md content
- Coverage threshold: 90%
