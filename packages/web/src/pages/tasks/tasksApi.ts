import { api } from "@/lib/eden";

// These mirror the backend projections in microservices/core. Inlined here
// because @axel-saas/web doesn't pull in @axel-saas/db (and shouldn't — the
// frontend has no reason to import the schema package).
export type TaskState =
  | "unknown"
  | "running"
  | "completed"
  | "failed"
  | "review_ready"
  | "no_changes";

export type TaskEventType =
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.review_ready"
  | "task.no_changes";

/**
 * Shape of a task row returned by `GET /users/me/tasks`.
 *
 * Matches the `taskHandler` projection:
 *   { ...task, state, isTerminal, eventCount }
 */
export interface TaskListItem {
  id: string;
  userId: string;
  source: string;
  taskSummary: string | null;
  repo: string | null;
  branch: string | null;
  createdAt: string;
  updatedAt: string;
  state: TaskState;
  isTerminal: boolean;
  eventCount: number;
}

export interface TaskDetailEvent {
  id: string;
  taskId: string;
  eventType: TaskEventType;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface TaskDetail extends TaskListItem {
  latestEvent: TaskDetailEvent | null;
  events: TaskDetailEvent[];
}

function extractError(value: unknown, fallback: string): string {
  if (value && typeof value === "object") {
    // Shape 1: { error: "message" } or { error: { message: "..." } }
    if ("error" in value) {
      const err = (value as { error?: unknown }).error;
      if (typeof err === "string") return err;
      if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string") return m;
      }
    }
    // Shape 2: value itself is an error object with `.message` (e.g. the
    // eden treaty `response.error` payload).
    if ("message" in value) {
      const m = (value as { message?: unknown }).message;
      if (typeof m === "string") return m;
    }
  }
  return fallback;
}

/**
 * Fetch the authenticated user's tasks with projected state.
 */
export async function getTasks(): Promise<TaskListItem[]> {
  const response = await api.core.users.me.tasks.get();
  const data = response.data as
    | { success: true; tasks: TaskListItem[] }
    | { success: false; error: string }
    | null;

  if (data && data.success === true) {
    return data.tasks;
  }

  throw new Error(
    extractError(data ?? response.error, "Failed to fetch tasks"),
  );
}

/**
 * Fetch a single task with its latest event.
 *
 * NOTE: The backend currently returns `latestEvent` only — full event history
 * would need an additional endpoint. For now we surface what's available and
 * include the latest event in an `events` array so the timeline renders
 * consistently.
 */
export async function getTaskDetail(taskId: string): Promise<TaskDetail> {
  const response = await api.core.users.me.tasks({ taskId }).get();
  const data = response.data as
    | {
        success: true;
        task: TaskListItem & { latestEvent: TaskDetailEvent | null };
      }
    | { success: false; error: string }
    | null;

  if (data && data.success === true) {
    const events = data.task.latestEvent ? [data.task.latestEvent] : [];
    return { ...data.task, events };
  }

  throw new Error(
    extractError(data ?? response.error, "Failed to fetch task detail"),
  );
}
