import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTasks, type TaskListItem } from "@/pages/tasks/tasksApi";
import {
  AGENT_METADATA,
  type AgentId,
  type AgentMetadata,
  getAgentMetadata,
} from "@/lib/agentMetadata";
import { formatDuration } from "@/pages/tasks/taskDisplay";

const POLL_INTERVAL_MS = 10_000;
const WORKING_WINDOW_MS = 5 * 60 * 1000;

export type AgentDerivedStatus = "idle" | "busy" | "working";

export interface AgentStats {
  totalTasks: number;
  todayTasks: number;
  /** Human-readable average duration, empty string when not computable. */
  avgDuration: string;
}

export interface AgentGroup {
  metadata: AgentMetadata;
  status: AgentDerivedStatus;
  currentTask: string | null;
  lastActiveAt: string | null;
  tasks: TaskListItem[];
  stats: AgentStats;
}

export interface UseAgentTasksResult {
  /** Flat list of all tasks, newest first. */
  tasks: TaskListItem[];
  /**
   * Agents with activity (or the primary agent Axel if no activity). Ordered:
   * Axel first, then any other active agents in a stable order.
   */
  agents: AgentGroup[];
  loading: boolean;
  error: string | null;
  /** Trigger an immediate refetch. */
  refetch: () => void;
}

function isTerminal(task: TaskListItem): boolean {
  // Trust the backend's projection (`taskStateProjector.isTerminalState`).
  // Don't second-guess by also treating non-running states as terminal — that
  // misclassifies "unknown" (a task with no events yet) and would stop
  // polling before the first real state transition arrives.
  return task.isTerminal;
}

function startOfTodayIso(now: Date): number {
  // UTC, to match `startOfUtcDay` in tasksFilter.ts so Office's "today"
  // count and the Tasks page's "today" filter agree across timezones.
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function deriveStatus(tasks: TaskListItem[], now: Date): AgentDerivedStatus {
  const nowMs = now.getTime();
  const hasRunning = tasks.some((t) => t.state === "running");
  if (hasRunning) return "busy";
  const hasRecent = tasks.some(
    (t) => nowMs - new Date(t.updatedAt).getTime() < WORKING_WINDOW_MS,
  );
  if (hasRecent) return "working";
  return "idle";
}

function computeStats(tasks: TaskListItem[], now: Date): AgentStats {
  const todayStart = startOfTodayIso(now);
  let todayCount = 0;
  const durations: number[] = [];
  for (const t of tasks) {
    const createdMs = new Date(t.createdAt).getTime();
    if (createdMs >= todayStart) todayCount += 1;
    if (t.isTerminal) {
      const span = new Date(t.updatedAt).getTime() - createdMs;
      if (span > 0) durations.push(span);
    }
  }
  const avgMs =
    durations.length === 0
      ? 0
      : durations.reduce((acc, v) => acc + v, 0) / durations.length;
  return {
    totalTasks: tasks.length,
    todayTasks: todayCount,
    avgDuration: formatDuration(avgMs),
  };
}

function sortNewestFirst(tasks: TaskListItem[]): TaskListItem[] {
  return [...tasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function groupTasksByAgent(
  tasks: TaskListItem[],
  now: Date = new Date(),
): AgentGroup[] {
  const buckets = new Map<string, TaskListItem[]>();
  for (const task of tasks) {
    const key = task.source in AGENT_METADATA ? task.source : "axel";
    const list = buckets.get(key) ?? [];
    list.push(task);
    buckets.set(key, list);
  }

  // Axel is always present even with no tasks.
  if (!buckets.has("axel")) buckets.set("axel", []);

  const preferredOrder: AgentId[] = [
    "axel",
    "scribe",
    "relay",
    "keeper",
    "ops",
  ];
  const result: AgentGroup[] = [];
  for (const id of preferredOrder) {
    if (!buckets.has(id)) continue;
    const agentTasks = sortNewestFirst(buckets.get(id) ?? []);
    // Skip non-Axel agents with zero activity.
    if (id !== "axel" && agentTasks.length === 0) continue;
    const latest = agentTasks[0];
    result.push({
      metadata: getAgentMetadata(id),
      status: deriveStatus(agentTasks, now),
      currentTask:
        agentTasks.find((t) => t.state === "running")?.taskSummary ??
        latest?.taskSummary ??
        null,
      lastActiveAt: latest?.updatedAt ?? null,
      tasks: agentTasks,
      stats: computeStats(agentTasks, now),
    });
    buckets.delete(id);
  }
  // Any unexpected sources (shouldn't happen after the AGENT_METADATA guard
  // above, but future-proof) get lumped in at the end.
  for (const [id, agentTasks] of buckets) {
    const sorted = sortNewestFirst(agentTasks);
    result.push({
      metadata: getAgentMetadata(id),
      status: deriveStatus(sorted, now),
      currentTask:
        sorted.find((t) => t.state === "running")?.taskSummary ??
        sorted[0]?.taskSummary ??
        null,
      lastActiveAt: sorted[0]?.updatedAt ?? null,
      tasks: sorted,
      stats: computeStats(sorted, now),
    });
  }
  return result;
}

export function useAgentTasks(): UseAgentTasksResult {
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors `tasks` state for use inside `load`'s catch path: if a poll
  // fails we don't have fresh task data, so we fall back to whether the
  // last known list still had active tasks to decide if polling should
  // continue. Without this, a single transient error would otherwise
  // drop us off the polling cycle permanently.
  const tasksRef = useRef<TaskListItem[]>([]);

  const load = useCallback(async () => {
    let nextActive = tasksRef.current.some((t) => !isTerminal(t));
    try {
      const fetched = await getTasks();
      if (!mountedRef.current) return;
      const sorted = sortNewestFirst(fetched);
      tasksRef.current = sorted;
      setTasks(sorted);
      setError(null);
      nextActive = sorted.some((t) => !isTerminal(t));
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
      // Keep `nextActive` at its previous value so we re-arm and try again.
    } finally {
      if (mountedRef.current) setLoading(false);
    }
    if (mountedRef.current && nextActive) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void load();
      }, POLL_INTERVAL_MS);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [load]);

  const agents = useMemo(() => groupTasksByAgent(tasks), [tasks]);

  return {
    tasks,
    agents,
    loading,
    error,
    refetch: () => void load(),
  };
}
