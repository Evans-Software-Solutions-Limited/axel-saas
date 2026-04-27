/**
 * Shared display helpers for task status across Office and Tasks pages.
 * Extracted so the two views can never drift when a new task state lands.
 */

import type { TaskState } from "./tasksApi";

export const STATUS_COLOURS: Record<TaskState, string> = {
  running: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  review_ready: "bg-accent-muted text-accent",
  no_changes: "bg-muted/15 text-text-secondary",
  unknown: "bg-muted/15 text-text-secondary",
};

export const STATUS_LABELS: Record<TaskState, string> = {
  running: "In Progress",
  completed: "Completed",
  failed: "Failed",
  review_ready: "Review Ready",
  no_changes: "No Changes",
  unknown: "Pending",
};

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "Just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
