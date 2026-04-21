# Office (Agent Visualisation) — Agent Instructions

## Context

The Office page is the home screen for authenticated users. It shows AI agents in a pixel-art desk scene (desk view) and a detailed accordion list (list view). Both views are already built with hardcoded sample data. Your job is to wire them to real data.

## Key Decision: Derive From Tasks API

Do NOT create a new `/users/me/agents` endpoint. Instead, derive all agent data from the existing `/users/me/tasks` endpoint:

1. Fetch tasks → group by agent (using `source` field)
2. Agent metadata (name, role, sprite) is static — kept in a frontend constant
3. Stats computed from task events
4. Status derived from task states

This keeps the backend simple and avoids duplicating data.

## Key Files to Modify

| File                                | What to change                                  |
| ----------------------------------- | ----------------------------------------------- |
| `packages/web/src/pages/Office.tsx` | Replace hardcoded `agents` array with hook data |
| `packages/web/src/pages/Tasks.tsx`  | Share the same data hook                        |

## Key Files to Create

| File                                      | Purpose                                                 |
| ----------------------------------------- | ------------------------------------------------------- |
| `packages/web/src/hooks/useAgentTasks.ts` | Shared hook: fetch tasks, group by agent, compute stats |
| `packages/web/src/lib/agentMetadata.ts`   | Static agent metadata (name, role, sprite, colour)      |

## Agent Metadata (Static)

```typescript
export const AGENT_METADATA: Record<string, AgentMeta> = {
  axel: {
    name: "Axel",
    role: "Chief Task Handler",
    spriteImage: "/sprites/sprite-axel.png",
    avatarColour: "bg-blue-600",
  },
  scribe: {
    name: "Scribe",
    role: "Document Writer",
    spriteImage: "/sprites/sprite-scribe.png",
    avatarColour: "bg-emerald-600",
  },
  relay: {
    name: "Relay",
    role: "Comms Manager",
    spriteImage: "/sprites/sprite-relay.png",
    avatarColour: "bg-violet-600",
  },
  keeper: {
    name: "Keeper",
    role: "Knowledge Manager",
    spriteImage: "/sprites/sprite-keeper.png",
    avatarColour: "bg-amber-600",
  },
  ops: {
    name: "Ops",
    role: "Automation Runner",
    spriteImage: "/sprites/sprite-ops.png",
    avatarColour: "bg-rose-600",
  },
};
```

## Status Derivation Logic

```typescript
function deriveStatus(tasks: Task[]): AgentStatus {
  const inProgress = tasks.find((t) => t.state === "running");
  if (inProgress) return "busy";

  const recent = tasks.find((t) => {
    const age = Date.now() - new Date(t.updatedAt).getTime();
    return age < 5 * 60 * 1000; // 5 minutes
  });
  if (recent) return "working";

  return "idle";
}
```

## Rules

1. **Axel is always shown** even with zero tasks — he's the primary agent
2. **Other agents only appear if they have task activity** — don't show all 5 by default
3. **Desk positions are dynamic** — use `DeskPositions[i]` based on array index, not hardcoded per-agent
4. **Polling interval: 10 seconds** — use `setInterval` with cleanup, not React Query refetchInterval (to avoid unnecessary re-renders)
5. **Empty state is important** — new users will see this first. Make it welcoming, not broken.
6. **Don't break the existing pixel art** — the desk view visuals are done, you're just changing the data source

## Testing Notes

- The `useAgentTasks` hook should be testable in isolation (mock fetch, verify grouping/stats)
- Test with 0 tasks, 1 task, many tasks across multiple agents
- Test status derivation edge cases (stale timestamps, mixed states)
- Don't test pixel positioning (visual, not unit-testable)
