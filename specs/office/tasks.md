# Office (Agent Visualisation) — Tasks

## Shared Data Layer
- [ ] Create `packages/web/src/hooks/useAgentTasks.ts` — shared hook that fetches `/users/me/tasks`, groups by agent, computes per-agent stats
- [ ] Define agent metadata map (id → name, role, spriteImage, avatarColour) as a constant — this is static product data, not API-driven
- [ ] Implement polling (10-second interval) with cleanup on unmount
- [ ] Handle loading, error, and empty states

## Backend (if needed)
- [ ] Evaluate whether existing `/users/me/tasks` endpoint returns enough data (agent/source field, task summary, events)
- [ ] If tasks don't have an `agent` field: add `agent_id` or use `source` field to identify which agent ran the task
- [ ] Ensure task list endpoint returns recent tasks with projected state (it already does via `taskStateProjector`)

## Office Page — Desk View
- [ ] Replace hardcoded `agents` array in `Office.tsx` with data from `useAgentTasks` hook
- [ ] Dynamic desk positioning: assign `DeskPositions[i]` based on active agents (not hardcoded per-agent)
- [ ] Only render agents that have task activity or are the primary agent (Axel)
- [ ] Wire status: any in-progress task → "busy", recent task (< 5 min) → "working", else → "idle"
- [ ] Wire `currentTask` from latest in-progress task summary
- [ ] Wire `lastActive` from latest task event timestamp

## Office Page — List View
- [ ] Replace hardcoded `recentJobs` with real tasks per agent
- [ ] Compute `stats.totalTasks`, `stats.todayTasks`, `stats.avgDuration` from task events
- [ ] Map task event types to display: `task.completed` → "Completed", `task.started` → "In Progress", `task.failed` → "Failed"
- [ ] Wire `job.type` from task source or summary categorisation

## Empty State
- [ ] Add empty state when no tasks exist: show Axel alone, message, CTA to chat
- [ ] Ensure desk view renders correctly with only 1 agent (Axel)

## Quick Chat
- [ ] Wire `onQuickChat` prop to navigate to `/dashboard/chat` (or open a slide-out panel)

## Tests
- [ ] Unit tests for `useAgentTasks` hook (data grouping, stat computation, status derivation)
- [ ] Component tests for Office with mocked task data
- [ ] Component tests for empty state rendering
- [ ] Test dynamic positioning with 1, 3, and 5 agents

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
