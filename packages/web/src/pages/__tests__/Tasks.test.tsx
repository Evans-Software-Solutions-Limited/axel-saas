import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Tasks } from "../Tasks";
import { filterTasks } from "@/pages/tasks/tasksFilter";
import type { TaskListItem } from "@/pages/tasks/tasksApi";

const { getTasksMock, getTaskDetailMock } = vi.hoisted(() => ({
  getTasksMock: vi.fn(),
  getTaskDetailMock: vi.fn(),
}));

vi.mock("@/pages/tasks/tasksApi", () => ({
  getTasks: getTasksMock,
  getTaskDetail: getTaskDetailMock,
}));

function makeTask(overrides: Partial<TaskListItem> = {}): TaskListItem {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: "user-1",
    source: overrides.source ?? "axel",
    taskSummary: overrides.taskSummary ?? "Process email inbox",
    repo: overrides.repo ?? null,
    branch: overrides.branch ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    state: overrides.state ?? "running",
    isTerminal:
      overrides.isTerminal ??
      (overrides.state ? overrides.state !== "running" : false),
    eventCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTasksMock.mockResolvedValue([]);
});

afterEach(() => cleanup());

describe("Tasks page", () => {
  it("shows empty state with CTA when no tasks", async () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await screen.findByText(/No tasks yet/i);
    expect(screen.getByText(/Go to Chat/i)).toBeDefined();
  });

  it("surfaces fetch errors", async () => {
    getTasksMock.mockRejectedValueOnce(new Error("down"));
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("down");
  });

  it("renders task rows with mapped status and agent", async () => {
    getTasksMock.mockResolvedValueOnce([
      makeTask({
        taskSummary: "Process email inbox",
        source: "axel",
        state: "running",
      }),
      makeTask({
        taskSummary: "Generate weekly report",
        source: "ops",
        state: "completed",
      }),
    ]);
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await screen.findByText("Process email inbox");
    expect(screen.getByText("Generate weekly report")).toBeDefined();
    expect(screen.getByText("In Progress")).toBeDefined();
    expect(screen.getByText("Completed")).toBeDefined();
    expect(screen.getByText("Axel")).toBeDefined();
    expect(screen.getByText("Ops")).toBeDefined();
  });

  it("filters by search term", async () => {
    getTasksMock.mockResolvedValueOnce([
      makeTask({ taskSummary: "Process email inbox" }),
      makeTask({ taskSummary: "Generate weekly report" }),
    ]);
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await screen.findByText("Process email inbox");
    const search = screen.getByPlaceholderText(/search tasks/i);
    fireEvent.change(search, { target: { value: "email" } });
    expect(screen.getByText("Process email inbox")).toBeDefined();
    expect(screen.queryByText("Generate weekly report")).toBeNull();
  });

  it("shows 'no results' when filters match nothing", async () => {
    getTasksMock.mockResolvedValueOnce([
      makeTask({ taskSummary: "Process email inbox" }),
    ]);
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await screen.findByText("Process email inbox");
    const search = screen.getByPlaceholderText(/search tasks/i);
    fireEvent.change(search, { target: { value: "zzzzzz" } });
    expect(screen.getByText(/No results match/i)).toBeDefined();
  });

  it("expands a row on click and loads detail", async () => {
    const task = makeTask({
      id: "task-1",
      taskSummary: "Write report",
      state: "completed",
      source: "scribe",
      repo: "acme/docs",
      branch: "main",
    });
    getTasksMock.mockResolvedValueOnce([task]);
    getTaskDetailMock.mockResolvedValueOnce({
      ...task,
      latestEvent: {
        id: "ev-1",
        taskId: "task-1",
        eventType: "task.completed",
        source: "scribe",
        payload: {},
        createdAt: task.createdAt,
      },
      events: [
        {
          id: "ev-1",
          taskId: "task-1",
          eventType: "task.completed",
          source: "scribe",
          payload: {},
          createdAt: task.createdAt,
        },
      ],
    });
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    const row = await screen.findByText("Write report");
    fireEvent.click(row);
    await waitFor(() =>
      expect(getTaskDetailMock).toHaveBeenCalledWith("task-1"),
    );
    await screen.findByText("task.completed");
    expect(screen.getByText("acme/docs")).toBeDefined();
    expect(screen.getByText("Event timeline")).toBeDefined();
  });

  it("surfaces detail fetch errors in the expanded row", async () => {
    const task = makeTask({ id: "task-2", taskSummary: "Broken task" });
    getTasksMock.mockResolvedValueOnce([task]);
    getTaskDetailMock.mockRejectedValueOnce(new Error("nope"));
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    const row = await screen.findByText("Broken task");
    fireEvent.click(row);
    await waitFor(() => {
      const alerts = screen.getAllByRole("alert");
      expect(alerts.some((a) => a.textContent?.includes("nope"))).toBe(true);
    });
  });

  it("toggling the same row collapses it", async () => {
    const task = makeTask({ id: "t-3", taskSummary: "Toggle me" });
    getTasksMock.mockResolvedValueOnce([task]);
    getTaskDetailMock.mockResolvedValue({
      ...task,
      latestEvent: null,
      events: [],
    });
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    const row = await screen.findByText("Toggle me");
    fireEvent.click(row);
    await screen.findByText("Event timeline");
    fireEvent.click(row);
    expect(screen.queryByText("Event timeline")).toBeNull();
  });

  it("keyboard Enter key expands a row", async () => {
    const task = makeTask({ id: "t-4", taskSummary: "Keyboard row" });
    getTasksMock.mockResolvedValueOnce([task]);
    getTaskDetailMock.mockResolvedValue({
      ...task,
      latestEvent: null,
      events: [],
    });
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>,
    );
    await screen.findByText("Keyboard row");
    const row = screen.getByText("Keyboard row").closest("tr")!;
    fireEvent.keyDown(row, { key: "Enter" });
    await screen.findByText("Event timeline");
  });
});

describe("filterTasks", () => {
  const now = new Date("2026-04-22T12:00:00Z");
  const base = makeTask;
  const tasks: TaskListItem[] = [
    base({
      id: "a",
      taskSummary: "Apple pie",
      source: "axel",
      state: "running",
      isTerminal: false,
      createdAt: new Date("2026-04-22T06:00:00Z").toISOString(),
    }),
    base({
      id: "b",
      taskSummary: "Banana bread",
      source: "scribe",
      state: "completed",
      isTerminal: true,
      createdAt: new Date("2026-04-15T10:00:00Z").toISOString(),
    }),
    base({
      id: "c",
      taskSummary: "Carrot cake",
      source: "scribe",
      state: "failed",
      isTerminal: true,
      createdAt: new Date("2026-01-01T10:00:00Z").toISOString(),
    }),
  ];

  it("filters by search term", () => {
    const r = filterTasks(tasks, {
      searchTerm: "apple",
      statusFilter: "all",
      agentFilter: "all",
      dateRange: "all",
      now,
    });
    expect(r.map((t) => t.id)).toEqual(["a"]);
  });

  it("filters by status", () => {
    const r = filterTasks(tasks, {
      searchTerm: "",
      statusFilter: "failed",
      agentFilter: "all",
      dateRange: "all",
      now,
    });
    expect(r.map((t) => t.id)).toEqual(["c"]);
  });

  it("filters by agent", () => {
    const r = filterTasks(tasks, {
      searchTerm: "",
      statusFilter: "all",
      agentFilter: "scribe",
      dateRange: "all",
      now,
    });
    expect(r.map((t) => t.id).sort()).toEqual(["b", "c"]);
  });

  it("filters by today date range", () => {
    const r = filterTasks(tasks, {
      searchTerm: "",
      statusFilter: "all",
      agentFilter: "all",
      dateRange: "today",
      now,
    });
    expect(r.map((t) => t.id)).toEqual(["a"]);
  });

  it("filters by last 7 days", () => {
    const r = filterTasks(tasks, {
      searchTerm: "",
      statusFilter: "all",
      agentFilter: "all",
      dateRange: "7d",
      now,
    });
    expect(r.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by last 30 days", () => {
    const r = filterTasks(tasks, {
      searchTerm: "",
      statusFilter: "all",
      agentFilter: "all",
      dateRange: "30d",
      now,
    });
    expect(r.map((t) => t.id).sort()).toEqual(["a", "b"]);
  });

  it("combines filters", () => {
    const r = filterTasks(tasks, {
      searchTerm: "b",
      statusFilter: "completed",
      agentFilter: "scribe",
      dateRange: "7d",
      now,
    });
    expect(r.map((t) => t.id)).toEqual(["b"]);
  });
});
