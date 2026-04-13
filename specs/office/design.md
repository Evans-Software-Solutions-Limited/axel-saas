# Office (Agent Visualisation) — Design

## Overview

The Office is the home screen for authenticated users. It shows their AI agents visually — a pixel-art desk view where each agent sits at a workstation, plus a list view with detailed status. Currently fully hardcoded with sample data.

## Architecture

### Data Source

Agent data comes from two sources:
1. **Agent roster** — which agents the user has (based on their OpenClaw workspace config)
2. **Task activity** — what each agent is doing (from the existing `/users/me/tasks` API + task events)

### Agent Model

Every user gets **Axel** (the primary agent). Sub-agents are spawned by Axel via OpenClaw's multi-agent orchestration. The sub-agents available depend on tier and what the user has configured.

**Fixed agents (all tiers):**
- **Axel** — Chief coordinator. Always present. Routes work to sub-agents.

**Dynamic sub-agents (provisioned based on integrations + tier):**
- **Scribe** — Document writer. Active when file/doc integrations are connected.
- **Relay** — Comms manager. Active when email/messaging channels are connected.
- **Keeper** — Knowledge manager. Active when knowledge sources (Notion, Drive) are connected.
- **Ops** — Automation runner. Active when cron/scheduled tasks exist.

Premium users can have all sub-agents active. Free users may have 1-2 based on connected integrations.

### API Contract

**New endpoint needed:**

```
GET /users/me/agents
→ Returns:
{
  agents: [
    {
      id: "axel",
      name: "Axel",
      role: "Chief Task Handler",
      status: "idle" | "busy" | "working",
      currentTask: string | null,
      lastActiveAt: string (ISO timestamp),
      stats: {
        totalTasks: number,
        todayTasks: number,
        avgDurationMs: number
      }
    },
    ...
  ]
}
```

This endpoint aggregates:
- Agent roster from provisioning state / workspace config
- Task data from existing `tasks` + `task_events` tables
- Status derived from: any in-progress task → "busy", recent task (< 5 min) → "working", else → "idle"

**Alternative (simpler MVP approach):**
Skip the dedicated endpoint. Derive agent data entirely from `/users/me/tasks`:
- Group tasks by agent/source
- Infer which agents exist from task sources
- Calculate stats from task events
- Hardcode the agent metadata (name, role, sprite) on the frontend, keyed by agent ID

This is simpler and avoids a new backend endpoint. The office just becomes a **view over the tasks API**.

## Frontend Design

### Desk View (existing, needs wiring)

The pixel-art office with sprite characters is already built. Changes:
- Replace hardcoded `agents` array with API-driven data
- Dynamic agent count (don't show agents that aren't active for this user)
- Desk positions assigned dynamically based on how many agents are active
- Status indicators driven by real task state
- Hover tooltip shows actual current task, not sample text

### List View (existing, needs wiring)

The accordion list with stats and recent jobs is already built. Changes:
- Replace hardcoded data with real task history
- Stats computed from task events
- "Recent jobs" pulled from `/users/me/tasks` filtered per agent

### Empty State

When user has no tasks yet (fresh after onboarding):

```
┌─────────────────────────────────────────────┐
│  [pixel art office — Axel at desk, alone]   │
│                                             │
│  Axel is ready and waiting.                 │
│  Start a conversation to put your           │
│  assistant to work.                         │
│                                             │
│  [Go to Chat →]                             │
└─────────────────────────────────────────────┘
```

### Real-time Updates

- Poll `/users/me/tasks` every 10 seconds when office is visible
- Update agent status and current task on each poll
- No WebSocket needed for MVP — polling is sufficient

## Sprite Assets

Existing sprites in `/public/sprites/`:
- `sprite-axel.png`
- `sprite-scribe.png`
- `sprite-relay.png`
- `sprite-keeper.png`
- `sprite-ops.png`

These are fine. No new assets needed.

## Relationship to Tasks Page

The Office is a **visual summary** of task activity. The Tasks page is the **detailed list**. They share the same data source (`/users/me/tasks`). Consider extracting a shared data hook:

```typescript
// hooks/useAgentTasks.ts
function useAgentTasks() {
  // Fetches tasks, groups by agent, computes stats
  // Used by both Office and Tasks pages
}
```
