# Crons & Schedules — Design

## Overview

Crons are user-defined scheduled automations — recurring tasks that Axel runs automatically. Examples: "Send me a daily brief at 9am", "Check my inbox every hour", "Generate a weekly report every Monday".

OpenClaw has built-in cron/wakeup support. Our job is to give users a UI to create, view, enable/disable, and monitor scheduled tasks.

## Architecture

```
User creates schedule in frontend
  → Backend stores schedule in DB
    → Backend writes schedule to user's workspace (HEARTBEAT.md or openclaw.json cron config)
      → OpenClaw picks up cron and executes on schedule
        → Execution creates task events (visible in Tasks page)
```

### OpenClaw Cron Model

OpenClaw supports cron via:
1. **HEARTBEAT.md** — periodic check-in tasks (2-4x/day, already templated)
2. **Cron/wakeup skill** — built-in tool for scheduled execution

For Axel SaaS, user-defined schedules should be stored in our DB (so we can show them in the UI) and propagated to the workspace as cron entries.

## Database Schema

```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Daily email digest"
  description TEXT,                      -- "Summarise and send inbox highlights"
  cron_expression TEXT NOT NULL,         -- "0 9 * * *" (standard cron)
  timezone TEXT NOT NULL DEFAULT 'UTC',  -- User's timezone
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_run_status TEXT,                  -- "success" | "failed" | null
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_schedules_user_id ON schedules(user_id);
```

## API Endpoints

```
GET /users/me/schedules
  → Returns all user schedules with status

POST /users/me/schedules
  Body: { name, description?, cronExpression, timezone? }
  → Creates schedule, propagates to workspace
  → Returns created schedule

PUT /users/me/schedules/:id
  Body: { name?, description?, cronExpression?, timezone?, enabled? }
  → Updates schedule, propagates change
  → Returns updated schedule

DELETE /users/me/schedules/:id
  → Deletes schedule, removes from workspace
  → Returns { status: "deleted" }

POST /users/me/schedules/:id/run
  → Trigger immediate execution (creates task)
  → Returns { taskId }
```

## Frontend UI

### Schedules Page (`/dashboard/crons`)

```
┌─────────────────────────────────────────────────┐
│  Automated Schedules                [+ New]     │
│  Recurring tasks your agents run automatically  │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ 📅 Daily email digest         [toggle]  │    │
│  │ Every day at 9:00 AM (UTC+1)            │    │
│  │ Last run: Today 09:00 ✓  Next: Tomorrow │    │
│  │                      [Run now] [Edit] ⋮ │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ 📋 Weekly report           [toggle]     │    │
│  │ Every Monday at 2:00 PM (UTC+1)         │    │
│  │ Last run: Monday 14:00 ✓  Next: Monday  │    │
│  │                      [Run now] [Edit] ⋮ │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Empty? "No schedules yet. Create one to have   │
│  Axel handle recurring tasks automatically."    │
└─────────────────────────────────────────────────┘
```

### Create/Edit Modal

```
┌─────────────────────────────────────┐
│  New Schedule                       │
│                                     │
│  Name                               │
│  ┌────────────────────────────┐     │
│  │ Daily email digest         │     │
│  └────────────────────────────┘     │
│                                     │
│  What should Axel do?               │
│  ┌────────────────────────────┐     │
│  │ Check my inbox and send    │     │
│  │ a summary of important     │     │
│  │ emails                     │     │
│  └────────────────────────────┘     │
│                                     │
│  Schedule                           │
│  [Every day ▼] at [09:00 ▼]        │
│                                     │
│  Timezone: [Europe/London ▼]        │
│                                     │
│  [Cancel]         [Create]          │
│                                     │
│  Advanced: Raw cron expression      │
│  ┌────────────────────────────┐     │
│  │ 0 9 * * *                  │     │
│  └────────────────────────────┘     │
└─────────────────────────────────────┘
```

### Schedule Presets (for non-technical users)

Instead of raw cron expressions, offer friendly presets:

| Preset | Cron Expression |
|---|---|
| Every day at [time] | `0 {H} * * *` |
| Every weekday at [time] | `0 {H} * * 1-5` |
| Every [day] at [time] | `0 {H} * * {D}` |
| Every [N] hours | `0 */{N} * * *` |
| Custom (advanced) | Raw cron input |

## Workspace Propagation

When a schedule is created/updated/deleted:
1. Update the user's `HEARTBEAT.md` with human-readable schedule list
2. Update `openclaw.json` cron config if OpenClaw supports declarative cron entries
3. Or use OpenClaw's wakeup skill to register the cron

## Relationship to Tasks

Each cron execution creates a task (via the existing task system). The Crons page shows schedules; the Tasks page shows individual executions. Link between them:
- Schedule card shows "Last run" status with link to task
- Task detail shows "Triggered by: Daily email digest" with link to schedule
