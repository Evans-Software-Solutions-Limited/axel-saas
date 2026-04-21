# Tasks — Design

## Overview

The Tasks page shows everything the user's agents have worked on — a filterable, searchable table of task activity. The backend already has the `/users/me/tasks` endpoint with event-sourced state projection. The frontend has a scaffolded table UI with sample data.

## Current State

**Backend (done):**

- `GET /users/me/tasks` — returns tasks with projected state from events
- `GET /users/me/tasks/:taskId` — returns single task with events
- Task states: `unknown`, `running`, `completed`, `failed`, `review_ready`, `no_changes`
- Event types: `task.started`, `task.completed`, `task.failed`, `task.review_ready`, `task.no_changes`
- Tasks have: `id`, `userId`, `source`, `taskSummary`, `repo`, `branch`, `createdAt`

**Frontend (scaffolded but hardcoded):**

- Table with columns: Task, Agent, Status, Due Date
- Search + status filter
- Sample data array

## Changes Required

### Frontend — Wire to API

Replace `SAMPLE_TASKS` with real API data from `/users/me/tasks`.

**Column mapping:**
| Current Column | Data Source |
|---|---|
| Task | `task.taskSummary` |
| Agent | `task.source` → map to agent name via `AGENT_METADATA` |
| Status | Projected state from `taskStateProjector` |
| Time | `task.createdAt` (relative time, not "Due Date" — tasks don't have due dates) |

**Status mapping:**
| API State | Display | Colour |
|---|---|---|
| `running` | In Progress | warning (yellow) |
| `completed` | Completed | success (green) |
| `failed` | Failed | destructive (red) |
| `review_ready` | Review Ready | accent (teal) |
| `no_changes` | No Changes | muted (grey) |
| `unknown` | Pending | muted (grey) |

### Task Detail

Clicking a task row should expand or navigate to show:

- Full task summary
- Event timeline (from `task_events`)
- Source agent
- Repo/branch if applicable
- Duration (first event → terminal event)

**MVP approach:** Expandable row in the table (no separate page).

### Filters

Keep existing search + status filter. Add:

- Agent filter dropdown (derived from task sources)
- Date range (today / 7 days / 30 days / all)

### Polling

Poll every 10 seconds for tasks that are in non-terminal states (`running`). Stop polling when all visible tasks are terminal.

### Empty State

```
┌─────────────────────────────────────────────┐
│  No tasks yet                               │
│                                             │
│  When you give Axel something to do,        │
│  it'll show up here.                        │
│                                             │
│  [Go to Chat →]                             │
└─────────────────────────────────────────────┘
```

## API Client

```typescript
// packages/web/src/pages/tasks/tasksApi.ts
import { api } from "@/lib/eden";

export async function getTasks() {
  const { data, error } = await api.core.users.me.tasks.get();
  if (error) throw new Error(error.value?.error ?? "Failed to fetch tasks");
  return data.tasks;
}

export async function getTaskDetail(taskId: string) {
  const { data, error } = await api.core.users.me.tasks({ taskId }).get();
  if (error) throw new Error(error.value?.error ?? "Failed to fetch task");
  return data;
}
```

## Shared Hook

The `useAgentTasks` hook from the Office spec should be the data source here too. The Tasks page renders the flat list; the Office page groups by agent.
