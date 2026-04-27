import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAgentTasks, groupTasksByAgent } from "../useAgentTasks";
import type { TaskListItem } from "@/pages/tasks/tasksApi";

const { getTasksMock } = vi.hoisted(() => ({
  getTasksMock: vi.fn(),
}));

vi.mock("@/pages/tasks/tasksApi", () => ({
  getTasks: getTasksMock,
}));

function task(overrides: Partial<TaskListItem> = {}): TaskListItem {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: "u",
    source: overrides.source ?? "axel",
    taskSummary: overrides.taskSummary ?? "t",
    repo: null,
    branch: null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    state: overrides.state ?? "completed",
    isTerminal:
      overrides.isTerminal ??
      (overrides.state ? overrides.state !== "running" : true),
    eventCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTasksMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAgentTasks", () => {
  it("loads tasks and exposes agent groups", async () => {
    getTasksMock.mockResolvedValueOnce([
      task({
        source: "scribe",
        taskSummary: "Draft doc",
        state: "running",
        isTerminal: false,
      }),
      task({ source: "scribe", taskSummary: "Done doc", state: "completed" }),
    ]);
    const { result } = renderHook(() => useAgentTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toHaveLength(2);
    const scribe = result.current.agents.find(
      (a) => a.metadata.id === "scribe",
    );
    expect(scribe).toBeDefined();
    expect(scribe?.status).toBe("busy");
    expect(scribe?.currentTask).toBe("Draft doc");
  });

  it("always includes Axel even with no tasks", async () => {
    const { result } = renderHook(() => useAgentTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents).toHaveLength(1);
    expect(result.current.agents[0].metadata.id).toBe("axel");
  });

  it("exposes error message on failure", async () => {
    getTasksMock.mockRejectedValueOnce(new Error("server down"));
    const { result } = renderHook(() => useAgentTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("server down");
  });

  it("falls back to generic error for non-Error throws", async () => {
    getTasksMock.mockRejectedValueOnce("weird");
    const { result } = renderHook(() => useAgentTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to fetch tasks");
  });

  it("polls every 10s while tasks are running and stops when terminal", async () => {
    vi.useFakeTimers();
    getTasksMock
      .mockResolvedValueOnce([
        task({ id: "r1", state: "running", isTerminal: false }),
      ])
      .mockResolvedValueOnce([
        task({ id: "r1", state: "completed", isTerminal: true }),
      ]);
    const { result } = renderHook(() => useAgentTasks());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTasksMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await vi.waitFor(() => expect(getTasksMock).toHaveBeenCalledTimes(2));
    // Now terminal — further time should NOT trigger more fetches.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(getTasksMock).toHaveBeenCalledTimes(2);
  });

  it("refetch triggers immediate load", async () => {
    const { result } = renderHook(() => useAgentTasks());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTasksMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(getTasksMock).toHaveBeenCalledTimes(2));
  });

  it("keeps polling after a transient fetch error", async () => {
    vi.useFakeTimers();
    getTasksMock
      .mockResolvedValueOnce([
        task({ id: "r1", state: "running", isTerminal: false }),
      ])
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce([
        task({ id: "r1", state: "completed", isTerminal: true }),
      ]);
    const { result } = renderHook(() => useAgentTasks());
    await vi.waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTasksMock).toHaveBeenCalledTimes(1);
    // Second poll fails — the bug was that this killed the polling cycle.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await vi.waitFor(() => expect(getTasksMock).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(result.current.error).toBe("transient"));
    // Third poll must still fire and recover.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    await vi.waitFor(() => expect(getTasksMock).toHaveBeenCalledTimes(3));
    await vi.waitFor(() => expect(result.current.error).toBeNull());
  });
});

describe("groupTasksByAgent", () => {
  const now = new Date("2026-04-22T12:00:00Z");

  it("marks agent 'busy' when any task is running", () => {
    const groups = groupTasksByAgent(
      [
        task({
          source: "axel",
          state: "running",
          isTerminal: false,
          updatedAt: now.toISOString(),
        }),
      ],
      now,
    );
    expect(groups[0].status).toBe("busy");
  });

  it("marks agent 'working' when recent task within 5 min", () => {
    const recent = new Date(now.getTime() - 60_000).toISOString();
    const groups = groupTasksByAgent(
      [
        task({
          source: "axel",
          state: "completed",
          isTerminal: true,
          updatedAt: recent,
          createdAt: recent,
        }),
      ],
      now,
    );
    expect(groups[0].status).toBe("working");
  });

  it("marks agent 'idle' when no recent activity", () => {
    const old = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const groups = groupTasksByAgent(
      [
        task({
          source: "axel",
          state: "completed",
          isTerminal: true,
          updatedAt: old,
          createdAt: old,
        }),
      ],
      now,
    );
    expect(groups[0].status).toBe("idle");
  });

  it("computes stats: total, today, avg duration", () => {
    const todayIso = new Date(now.getTime() - 30 * 60_000).toISOString();
    const yesterday = new Date(
      now.getTime() - 26 * 60 * 60 * 1000,
    ).toISOString();
    const groups = groupTasksByAgent(
      [
        task({
          source: "axel",
          state: "completed",
          createdAt: todayIso,
          updatedAt: new Date(
            new Date(todayIso).getTime() + 60_000,
          ).toISOString(),
        }),
        task({
          source: "axel",
          state: "completed",
          createdAt: yesterday,
          updatedAt: new Date(
            new Date(yesterday).getTime() + 120_000,
          ).toISOString(),
        }),
      ],
      now,
    );
    const axel = groups[0];
    expect(axel.stats.totalTasks).toBe(2);
    expect(axel.stats.todayTasks).toBe(1);
    // Average of 60s and 120s = 90s → "1m 30s"
    expect(axel.stats.avgDuration).toBe("1m 30s");
  });

  it("omits sub-agents with no tasks", () => {
    const groups = groupTasksByAgent([], now);
    expect(groups.map((g) => g.metadata.id)).toEqual(["axel"]);
  });

  it("keeps Axel first and orders sub-agents by preferred order", () => {
    const groups = groupTasksByAgent(
      [
        task({ source: "ops" }),
        task({ source: "scribe" }),
        task({ source: "relay" }),
      ],
      now,
    );
    expect(groups.map((g) => g.metadata.id)).toEqual([
      "axel",
      "scribe",
      "relay",
      "ops",
    ]);
  });

  it("handles unknown sources by lumping them under axel", () => {
    const groups = groupTasksByAgent(
      [task({ source: "mystery", taskSummary: "weird" })],
      now,
    );
    // Unknown source is grouped under axel (our guard).
    const axel = groups.find((g) => g.metadata.id === "axel");
    expect(axel?.tasks).toHaveLength(1);
  });

  it("uses UTC (not local) midnight for today stats", () => {
    // `now` is just past UTC midnight; the task is just before it.
    // In any TZ with a positive UTC offset, `setHours(0,0,0,0)` would push
    // local midnight back into the previous UTC day and wrongly include the
    // task in today's count. The fix uses `setUTCHours`.
    const now = new Date("2026-04-22T00:30:00Z");
    const groups = groupTasksByAgent(
      [
        task({
          source: "axel",
          state: "completed",
          createdAt: "2026-04-21T23:00:00Z",
          updatedAt: "2026-04-21T23:00:00Z",
        }),
      ],
      now,
    );
    expect(groups[0].stats.todayTasks).toBe(0);
  });

  it("returns empty avg duration when no terminal tasks", () => {
    const groups = groupTasksByAgent(
      [
        task({
          source: "axel",
          state: "running",
          isTerminal: false,
          updatedAt: now.toISOString(),
        }),
      ],
      now,
    );
    expect(groups[0].stats.avgDuration).toBe("");
  });
});
