# Tasks — Agent Instructions

## Context

The Tasks page shows a filterable table of everything the user's agents have worked on. The backend API exists (`/users/me/tasks` with event-sourced state projection). The frontend table is scaffolded but uses hardcoded sample data. Your job is to wire it to real data and add detail views.

## Key Files to Modify

| File | What to change |
|---|---|
| `packages/web/src/pages/Tasks.tsx` | Replace SAMPLE_TASKS with API data, update columns, add expandable detail |

## Key Files to Create

| File | Purpose |
|---|---|
| `packages/web/src/pages/tasks/tasksApi.ts` | Eden client calls for task endpoints |

## Shared Dependencies

- Uses `useAgentTasks` hook from `packages/web/src/hooks/useAgentTasks.ts` (created in Office spec)
- Uses `AGENT_METADATA` from `packages/web/src/lib/agentMetadata.ts` (created in Office spec)
- If those don't exist yet, create them — they're shared between Office and Tasks

## Backend API Shape (Already Exists)

```typescript
// GET /users/me/tasks returns:
{
  tasks: Array<{
    id: string;
    userId: string;
    source: string;        // Agent ID: "axel", "scribe", etc.
    taskSummary: string;
    repo: string | null;
    branch: string | null;
    createdAt: string;
    updatedAt: string;
    state: string;         // Projected: "running" | "completed" | "failed" | "review_ready" | "no_changes" | "unknown"
    eventCount: number;
  }>
}

// GET /users/me/tasks/:taskId returns:
{
  task: { ...same as above },
  events: Array<{
    id: string;
    eventType: string;     // "task.started", "task.completed", etc.
    source: string;
    payload: object;
    createdAt: string;
  }>
}
```

## Rules

1. **Don't rename columns arbitrarily.** "Due Date" becomes "Time" (relative timestamp). Tasks don't have due dates.
2. **Status badges must match the design system colours** already in use (success, warning, destructive, accent, muted).
3. **Expandable row, not a new page.** Keep the user on the tasks list.
4. **Polling is for running tasks only.** Don't hammer the API when everything is terminal.
5. **Agent names come from AGENT_METADATA**, not from the API. The API gives `source: "axel"`, the frontend maps that to "Axel - Chief Task Handler".
6. **Empty state matters.** Every new user sees it first. Show a helpful CTA.

## Testing Notes

- Mock the eden API calls in tests
- Test filter combinations: search + status + agent + date range all combined
- Test expandable row opens/closes correctly
- Test polling starts and stops appropriately
- Coverage threshold: 90%
