import type { TaskEvent, TaskEventType, TaskState } from "@axel-saas/db";

/**
 * Project the current state of a task from its ordered event log.
 *
 * Rules:
 * - Empty log → "unknown" (task has no events yet)
 * - State is determined by the latest event type only (last-write-wins)
 * - Terminal states: completed, failed, review_ready, no_changes
 * - Running state: task.started (task is in progress)
 * - "no_changes" is NOT failure — it means the agent found nothing to do
 */
export function projectTaskState(events: TaskEvent[]): TaskState {
  if (events.length === 0) return "unknown";

  const latest = events[events.length - 1];

  const stateMap: Record<TaskEventType, TaskState> = {
    "task.started": "running",
    "task.completed": "completed",
    "task.failed": "failed",
    "task.review_ready": "review_ready",
    "task.no_changes": "no_changes",
  };

  return stateMap[latest.eventType as TaskEventType] ?? "unknown";
}

/**
 * Returns true if the projected state is terminal (no further events expected).
 */
export function isTerminalState(state: TaskState): boolean {
  return (
    state === "completed" ||
    state === "failed" ||
    state === "review_ready" ||
    state === "no_changes"
  );
}

export interface ProjectedTask {
  taskId: string;
  state: TaskState;
  isTerminal: boolean;
  eventCount: number;
  latestEvent: TaskEvent | null;
}

export function buildProjection(
  taskId: string,
  events: TaskEvent[],
): ProjectedTask {
  const state = projectTaskState(events);
  return {
    taskId,
    state,
    isTerminal: isTerminalState(state),
    eventCount: events.length,
    latestEvent: events[events.length - 1] ?? null,
  };
}
