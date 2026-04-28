import { Fragment, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "@axel-saas/ui/card";
import { Input } from "@axel-saas/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@axel-saas/ui/select";
import { Badge } from "@axel-saas/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@axel-saas/ui/table";
import {
  IconSearch,
  IconChevronDown,
  IconChevronRight,
} from "@tabler/icons-react";
import { useAgentTasks } from "@/hooks/useAgentTasks";
import {
  getAgentMetadata,
  AGENT_METADATA,
  type AgentId,
} from "@/lib/agentMetadata";
import {
  getTaskDetail,
  type TaskDetail,
  type TaskListItem,
} from "./tasks/tasksApi";
import { filterTasks, type DateRange } from "./tasks/tasksFilter";
import {
  STATUS_COLOURS,
  STATUS_LABELS,
  formatDuration,
  formatRelative,
} from "./tasks/taskDisplay";

export function Tasks() {
  const navigate = useNavigate();
  const { tasks, loading, error } = useAgentTasks();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filterTasks(tasks, {
        searchTerm,
        statusFilter,
        agentFilter,
        dateRange,
      }),
    [tasks, searchTerm, statusFilter, agentFilter, dateRange],
  );

  const uniqueAgents = useMemo(() => {
    const seen = new Set<string>();
    for (const t of tasks) seen.add(t.source);
    return Array.from(seen).sort();
  }, [tasks]);

  useEffect(() => {
    if (!expandedTaskId) return;
    let cancelled = false;
    // Standard async-fetch pattern: the setState calls happen asynchronously
    // inside `.then`/`.catch`/`.finally`, not synchronously in the effect
    // body. The `react-hooks/set-state-in-effect` rule flags any setState in
    // an effect including inside promise callbacks; we suppress here because
    // the alternative (pulling in react-query just for one detail fetch) is
    // disproportionate.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDetailLoading(true);

    setDetailError(null);
    getTaskDetail(expandedTaskId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setDetailError(
            err instanceof Error ? err.message : "Failed to load task detail",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedTaskId]);

  function toggleExpand(taskId: string) {
    setExpandedTaskId((current) => {
      const next = current === taskId ? null : taskId;
      // Clear stale detail state on collapse OR when switching to a different
      // row, otherwise the previous task's timeline keeps rendering until the
      // new fetch resolves.
      if (next !== current) {
        setDetail(null);
        setDetailError(null);
      }
      return next;
    });
  }

  const hasTasks = tasks.length > 0;
  const hasResults = filtered.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Tasks</h1>
        <p className="text-sm text-text-secondary mt-1">
          Track what your agents are working on
        </p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-60 relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30 transition-all duration-200"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            aria-label="Filter by status"
            className="w-40 bg-surface-raised border-border text-text"
          >
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-surface-raised border-border">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="running">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="review_ready">Review Ready</SelectItem>
            <SelectItem value="no_changes">No Changes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger
            aria-label="Filter by agent"
            className="w-40 bg-surface-raised border-border text-text"
          >
            <SelectValue placeholder="Filter by agent" />
          </SelectTrigger>
          <SelectContent className="bg-surface-raised border-border">
            <SelectItem value="all">All agents</SelectItem>
            {uniqueAgents.map((source) => (
              <SelectItem key={source} value={source}>
                {source in AGENT_METADATA
                  ? AGENT_METADATA[source as AgentId].name
                  : source}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={dateRange}
          onValueChange={(v) => setDateRange(v as DateRange)}
        >
          <SelectTrigger
            aria-label="Filter by date range"
            className="w-40 bg-surface-raised border-border text-text"
          >
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent className="bg-surface-raised border-border">
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div
          role="alert"
          className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2"
        >
          {error}
        </div>
      )}

      {loading && !hasTasks ? (
        <Card>
          <div
            role="status"
            aria-label="Loading tasks"
            className="p-6 space-y-3"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-surface-raised/60 animate-pulse rounded-lg"
              />
            ))}
          </div>
        </Card>
      ) : !hasTasks ? (
        <Card>
          <div className="p-10 flex flex-col items-center text-center gap-3">
            <div className="font-display font-semibold text-text text-lg">
              No tasks yet
            </div>
            <p className="text-sm text-text-secondary max-w-sm">
              When you give Axel something to do, it&rsquo;ll show up here.
            </p>
            <button
              type="button"
              onClick={() => navigate("/dashboard/chat")}
              className="mt-2 text-sm text-accent font-medium hover:underline"
            >
              Go to Chat →
            </button>
          </div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow className="border-border-subtle hover:bg-transparent">
                <TableHead className="w-10" />
                <TableHead className="text-text-secondary text-xs uppercase tracking-wider font-medium">
                  Task
                </TableHead>
                <TableHead className="text-text-secondary text-xs uppercase tracking-wider font-medium">
                  Agent
                </TableHead>
                <TableHead className="text-text-secondary text-xs uppercase tracking-wider font-medium">
                  Status
                </TableHead>
                <TableHead className="text-text-secondary text-xs uppercase tracking-wider font-medium">
                  Time
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!hasResults && (
                <TableRow className="border-border-subtle hover:bg-transparent">
                  <TableCell
                    colSpan={5}
                    className="text-center text-sm text-text-secondary py-8"
                  >
                    No results match your filters.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((task) => {
                const agent = getAgentMetadata(task.source);
                const isExpanded = expandedTaskId === task.id;
                return (
                  <Fragment key={task.id}>
                    <TableRow
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpand(task.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpand(task.id);
                        }
                      }}
                      className="border-border-subtle hover:bg-white/[0.02] transition-colors duration-150 cursor-pointer"
                    >
                      <TableCell className="text-text-secondary">
                        {isExpanded ? (
                          <IconChevronDown
                            aria-label="Collapse"
                            className="w-4 h-4"
                          />
                        ) : (
                          <IconChevronRight
                            aria-label="Expand"
                            className="w-4 h-4"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-text font-medium">
                        {task.taskSummary ?? "(no summary)"}
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {agent.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`${STATUS_COLOURS[task.state]} border-0`}
                        >
                          {STATUS_LABELS[task.state]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-text-secondary">
                        {formatRelative(task.createdAt)}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow className="border-border-subtle bg-surface-raised/40 hover:bg-surface-raised/40">
                        <TableCell colSpan={5} className="p-4">
                          <TaskDetailPanel
                            task={task}
                            detail={detail}
                            loading={detailLoading}
                            error={detailError}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

interface TaskDetailPanelProps {
  readonly task: TaskListItem;
  readonly detail: TaskDetail | null;
  readonly loading: boolean;
  readonly error: string | null;
}

function TaskDetailPanel({
  task,
  detail,
  loading,
  error,
}: TaskDetailPanelProps) {
  // Total elapsed time = task.updatedAt - task.createdAt. The event-timeline
  // approach (`updatedAt - events[0].createdAt`) is wrong because
  // `getTaskDetail` only returns the LATEST event in `events`, so its
  // createdAt is ~equal to `updatedAt` and the duration always renders as
  // ~0. `computeStats` in useAgentTasks uses task.createdAt for the same
  // reason — keep them aligned.
  const duration = detail
    ? new Date(detail.updatedAt).getTime() -
      new Date(detail.createdAt).getTime()
    : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <DetailField label="Summary" value={task.taskSummary ?? "(none)"} />
        <DetailField label="Agent" value={getAgentMetadata(task.source).name} />
        <DetailField label="Repo" value={task.repo ?? "—"} />
        <DetailField label="Branch" value={task.branch ?? "—"} />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-text-secondary mb-2">
          Event timeline
        </div>
        {loading && (
          <div role="status" className="text-sm text-text-secondary">
            Loading detail…
          </div>
        )}
        {error && (
          <div role="alert" className="text-sm text-destructive">
            {error}
          </div>
        )}
        {!loading && !error && detail && detail.events.length === 0 && (
          <div className="text-sm text-text-secondary">
            No events recorded yet.
          </div>
        )}
        {!loading && !error && detail && detail.events.length > 0 && (
          <ol className="space-y-1 text-sm">
            {detail.events.map((ev) => (
              <li
                key={ev.id}
                className="flex gap-2 border-b border-border-subtle py-1 last:border-0"
              >
                <span className="font-mono text-xs text-text-secondary shrink-0">
                  {new Date(ev.createdAt).toLocaleString()}
                </span>
                <span className="text-text">{ev.eventType}</span>
              </li>
            ))}
          </ol>
        )}
        {!loading && detail && (
          <div className="mt-2 text-xs text-text-secondary">
            Duration: {formatDuration(duration, { empty: "—" })}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-text-secondary">
        {label}
      </div>
      <div className="text-sm text-text truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
