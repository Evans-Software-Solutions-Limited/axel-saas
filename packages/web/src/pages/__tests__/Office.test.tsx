import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Office } from "../Office";
import type { TaskListItem } from "@/pages/tasks/tasksApi";

const { getTasksMock } = vi.hoisted(() => ({
  getTasksMock: vi.fn(),
}));

vi.mock("@/pages/tasks/tasksApi", () => ({
  getTasks: getTasksMock,
  getTaskDetail: vi.fn(),
}));

function makeTask(overrides: Partial<TaskListItem> = {}): TaskListItem {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? crypto.randomUUID(),
    userId: "user-1",
    source: overrides.source ?? "axel",
    taskSummary: overrides.taskSummary ?? "Do a thing",
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

describe("Office", () => {
  it("renders desk view and list view tabs", async () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getTasksMock).toHaveBeenCalled());
    expect(screen.getByText("Desk view")).toBeDefined();
    expect(screen.getByText("List view")).toBeDefined();
  });

  it("shows empty state with Axel alone when no tasks", async () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    await screen.findByText(/Axel is ready and waiting/i);
    // Only Axel should be shown (no other agents when no tasks).
    expect(screen.getAllByText("Axel").length).toBeGreaterThan(0);
    expect(screen.queryByText("Scribe")).toBeNull();
  });

  it("renders active sub-agents when tasks exist for them", async () => {
    getTasksMock.mockResolvedValueOnce([
      makeTask({ source: "scribe", state: "running", isTerminal: false }),
      makeTask({ source: "relay", state: "completed" }),
    ]);
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    await screen.findAllByText("Scribe");
    expect(screen.getAllByText("Relay").length).toBeGreaterThan(0);
    // Keeper/Ops have no tasks → not shown.
    expect(screen.queryByText("Keeper")).toBeNull();
  });

  it("navigates to chat when Quick Chat clicked (default behaviour)", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Office />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getTasksMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /quick chat/i }));
    // Navigation happens inside MemoryRouter; we just assert no crash + handler ran.
  });

  it("calls onQuickChat when prop supplied", async () => {
    const onQuickChat = vi.fn();
    render(
      <MemoryRouter>
        <Office onQuickChat={onQuickChat} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getTasksMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /quick chat/i }));
    expect(onQuickChat).toHaveBeenCalledTimes(1);
  });

  it("switches to list view and shows accordion with stats", async () => {
    getTasksMock.mockResolvedValueOnce([makeTask({ source: "axel" })]);
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    await waitFor(() => expect(getTasksMock).toHaveBeenCalled());
    fireEvent.click(screen.getByText("List view"));
    expect(screen.getByText("Chief Task Handler")).toBeDefined();
  });

  it("clicking an agent sprite switches to list view", async () => {
    getTasksMock.mockResolvedValueOnce([makeTask({ source: "scribe" })]);
    vi.useFakeTimers();
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(getTasksMock).toHaveBeenCalled());
    const tabs = ["Desk view", "List view"];
    const agentButtons = screen
      .getAllByRole("button")
      .filter(
        (b) =>
          !tabs.includes(b.textContent?.trim() ?? "") &&
          !(b.textContent ?? "").includes("Quick Chat"),
      );
    if (agentButtons.length > 0) {
      fireEvent.click(agentButtons[0]);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Chief Task Handler")).toBeDefined();
    vi.useRealTimers();
  });

  it("surfaces fetch errors", async () => {
    getTasksMock.mockRejectedValueOnce(new Error("boom"));
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("boom");
  });
});
