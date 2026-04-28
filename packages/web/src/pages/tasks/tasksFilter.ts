/**
 * Pure filter + date-window helpers for the Tasks page. Split out of Tasks.tsx
 * so react-refresh stays clean (components file should only export components).
 *
 * Date windows use calendar-day semantics (start-of-day UTC, N days back)
 * rather than rolling 24h slots — matches the user's mental model for
 * "last 7 days" better than strict 7 * 24h rolling windows would.
 */

import type { TaskListItem } from "./tasksApi";

export type DateRange = "all" | "today" | "7d" | "30d";

const DATE_RANGE_DAYS: Record<Exclude<DateRange, "all" | "today">, number> = {
  "7d": 7,
  "30d": 30,
};

export interface TaskFilterOptions {
  searchTerm: string;
  statusFilter: string;
  agentFilter: string;
  dateRange: DateRange;
  now?: Date;
}

/**
 * Epoch ms for the start of the given UTC day, optionally `daysBack` days
 * before. Exported so other consumers (e.g. `useAgentTasks` for the Office
 * "today" stat) can use the same UTC-aligned definition rather than each
 * file rolling their own `setUTCHours` clone.
 */
export function startOfUtcDay(date: Date, daysBack = 0): number {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function filterTasks(
  tasks: TaskListItem[],
  opts: TaskFilterOptions,
): TaskListItem[] {
  const now = opts.now ?? new Date();
  const term = opts.searchTerm.trim().toLowerCase();
  return tasks.filter((task) => {
    if (term && !(task.taskSummary ?? "").toLowerCase().includes(term)) {
      return false;
    }
    if (opts.statusFilter !== "all" && task.state !== opts.statusFilter) {
      return false;
    }
    if (opts.agentFilter !== "all" && task.source !== opts.agentFilter) {
      return false;
    }
    if (opts.dateRange !== "all") {
      const createdMs = new Date(task.createdAt).getTime();
      const daysBack =
        opts.dateRange === "today" ? 0 : DATE_RANGE_DAYS[opts.dateRange];
      if (createdMs < startOfUtcDay(now, daysBack)) return false;
    }
    return true;
  });
}
