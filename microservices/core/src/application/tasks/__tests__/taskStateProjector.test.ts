import { describe, it, expect } from "vitest";
import {
  projectTaskState,
  isTerminalState,
  buildProjection,
} from "../taskStateProjector";
import type { TaskEvent, TaskEventType } from "@axel-saas/db";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2025-01-01T00:00:00.000Z");

function makeEvent(
  eventType: TaskEventType | (string & Record<never, never>),
  overrides: Partial<TaskEvent> = {},
): TaskEvent {
  return {
    id: "evt-1",
    taskId: "task-1",
    eventType: eventType as TaskEventType,
    source: "chat",
    payload: {},
    createdAt: NOW,
    ...overrides,
  };
}

// ─── projectTaskState ─────────────────────────────────────────────────────────

describe("projectTaskState", () => {
  it("returns unknown for an empty event list", () => {
    expect(projectTaskState([])).toBe("unknown");
  });

  it("maps task.started → running", () => {
    expect(projectTaskState([makeEvent("task.started")])).toBe("running");
  });

  it("maps task.completed → completed", () => {
    expect(projectTaskState([makeEvent("task.completed")])).toBe("completed");
  });

  it("maps task.failed → failed", () => {
    expect(projectTaskState([makeEvent("task.failed")])).toBe("failed");
  });

  it("maps task.review_ready → review_ready", () => {
    expect(projectTaskState([makeEvent("task.review_ready")])).toBe(
      "review_ready",
    );
  });

  it("maps task.no_changes → no_changes", () => {
    expect(projectTaskState([makeEvent("task.no_changes")])).toBe("no_changes");
  });

  it("uses the latest event when multiple events exist", () => {
    const events = [
      makeEvent("task.started", { id: "evt-1" }),
      makeEvent("task.completed", { id: "evt-2" }),
    ];
    expect(projectTaskState(events)).toBe("completed");
  });

  it("uses the latest event even if it is a started event after a completed event", () => {
    // Out-of-order writes are possible; last event wins.
    const events = [
      makeEvent("task.completed", { id: "evt-1" }),
      makeEvent("task.started", { id: "evt-2" }),
    ];
    expect(projectTaskState(events)).toBe("running");
  });

  it("returns unknown for an unrecognised event type", () => {
    expect(projectTaskState([makeEvent("task.unknown_future_type")])).toBe(
      "unknown",
    );
  });

  it("no_changes is not the same as failed", () => {
    const state = projectTaskState([makeEvent("task.no_changes")]);
    expect(state).not.toBe("failed");
    expect(state).toBe("no_changes");
  });
});

// ─── isTerminalState ──────────────────────────────────────────────────────────

describe("isTerminalState", () => {
  it("completed is terminal", () => {
    expect(isTerminalState("completed")).toBe(true);
  });

  it("failed is terminal", () => {
    expect(isTerminalState("failed")).toBe(true);
  });

  it("review_ready is terminal", () => {
    expect(isTerminalState("review_ready")).toBe(true);
  });

  it("no_changes is terminal", () => {
    expect(isTerminalState("no_changes")).toBe(true);
  });

  it("running is not terminal", () => {
    expect(isTerminalState("running")).toBe(false);
  });

  it("unknown is not terminal", () => {
    expect(isTerminalState("unknown")).toBe(false);
  });
});

// ─── buildProjection ──────────────────────────────────────────────────────────

describe("buildProjection", () => {
  it("returns unknown projection for empty events", () => {
    const p = buildProjection("task-1", []);
    expect(p.taskId).toBe("task-1");
    expect(p.state).toBe("unknown");
    expect(p.isTerminal).toBe(false);
    expect(p.eventCount).toBe(0);
    expect(p.latestEvent).toBeNull();
  });

  it("returns running projection for a started task", () => {
    const events = [makeEvent("task.started")];
    const p = buildProjection("task-1", events);
    expect(p.state).toBe("running");
    expect(p.isTerminal).toBe(false);
    expect(p.eventCount).toBe(1);
    expect(p.latestEvent?.eventType).toBe("task.started");
  });

  it("returns terminal projection for a completed task", () => {
    const events = [
      makeEvent("task.started", { id: "evt-1" }),
      makeEvent("task.completed", { id: "evt-2" }),
    ];
    const p = buildProjection("task-1", events);
    expect(p.state).toBe("completed");
    expect(p.isTerminal).toBe(true);
    expect(p.eventCount).toBe(2);
    expect(p.latestEvent?.eventType).toBe("task.completed");
  });

  it("returns terminal projection for a failed task", () => {
    const events = [
      makeEvent("task.started", { id: "evt-1" }),
      makeEvent("task.failed", { id: "evt-2" }),
    ];
    const p = buildProjection("task-1", events);
    expect(p.state).toBe("failed");
    expect(p.isTerminal).toBe(true);
  });

  it("returns terminal projection for review_ready", () => {
    const events = [
      makeEvent("task.started", { id: "evt-1" }),
      makeEvent("task.review_ready", { id: "evt-2" }),
    ];
    const p = buildProjection("task-1", events);
    expect(p.state).toBe("review_ready");
    expect(p.isTerminal).toBe(true);
  });

  it("returns terminal projection for no_changes (not failed)", () => {
    const events = [
      makeEvent("task.started", { id: "evt-1" }),
      makeEvent("task.no_changes", { id: "evt-2" }),
    ];
    const p = buildProjection("task-1", events);
    expect(p.state).toBe("no_changes");
    expect(p.isTerminal).toBe(true);
    expect(p.state).not.toBe("failed");
  });
});
