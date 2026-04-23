import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getTasks, type TaskListItem } from "@/pages/tasks/tasksApi";
import {
  AGENT_METADATA,
  type AgentId,
  type AgentMetadata,
  getAgentMetadata,
} from "@/lib/agentMetadata";

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
  return task.isTerminal || task.state !== "running";
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function startOfTodayIso(now: Date): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
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

  const load = useCallback(async () => {
    try {
      const fetched = await getTasks();
      if (!mountedRef.current) return;
      setTasks(sortNewestFirst(fetched));
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  // Polling: re-evaluate after each load whether any tasks are still active.
  const hasActive = useMemo(() => tasks.some((t) => !isTerminal(t)), [tasks]);

  useEffect(() => {
    if (!hasActive) return;
    timerRef.current = setTimeout(() => {
      void load();
    }, POLL_INTERVAL_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [hasActive, tasks, load]);

  const agents = useMemo(() => groupTasksByAgent(tasks), [tasks]);

  return {
    tasks,
    agents,
    loading,
    error,
    refetch: () => void load(),
  };
}
