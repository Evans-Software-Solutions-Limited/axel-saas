# Tasks — Tasks

## API Client
- [ ] Create `packages/web/src/pages/tasks/tasksApi.ts` — eden client calls for task endpoints
- [ ] Verify `/users/me/tasks` response shape matches what frontend needs (summary, source/agent, projected state, events)

## Data Hook
- [ ] Use shared `useAgentTasks` hook from Office spec (or create if not yet built)
- [ ] Add flat task list accessor (not grouped by agent)
- [ ] Add polling logic: 10-second interval, stop when all terminal

## Task List Page
- [ ] Replace `SAMPLE_TASKS` in `packages/web/src/pages/Tasks.tsx` with API data
- [ ] Update column mapping: Task (summary), Agent (source → name), Status (projected state), Time (relative createdAt)
- [ ] Update status colours and labels to match API states (`running`, `completed`, `failed`, `review_ready`, `no_changes`)
- [ ] Add agent filter dropdown (derived from unique task sources)
- [ ] Add date range filter (today / 7 days / 30 days / all)
- [ ] Add loading skeleton state
- [ ] Add empty state with CTA to chat
- [ ] Add "No results" state for filter misses

## Task Detail (Expandable Row)
- [ ] Add expandable row on click — show full task detail inline
- [ ] Fetch task detail from `/users/me/tasks/:taskId` on expand
- [ ] Show event timeline (ordered list of events with timestamps)
- [ ] Show duration (time between first and terminal event)
- [ ] Show repo/branch if present
- [ ] Collapse on click again or click another row

## Tests
- [ ] Unit tests for task status mapping (API state → display label + colour)
- [ ] Unit tests for filter logic (search + status + agent + date range)
- [ ] Component tests for task table rendering with mocked data
- [ ] Component tests for empty state
- [ ] Component tests for expandable row detail
- [ ] Test polling lifecycle (start, update, stop on terminal)

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
