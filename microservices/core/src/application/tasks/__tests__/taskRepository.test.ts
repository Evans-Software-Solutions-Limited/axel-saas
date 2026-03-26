import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskRepository } from "../taskRepository";
import type { Db } from "@axel-saas/db";

/**
 * Fluent mock chain identical to the pattern used across this repo's test suite.
 */
function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  const fluent = [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "offset",
    "orderBy",
    "leftJoin",
    "innerJoin",
  ];

  for (const method of fluent) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (reject: Parameters<Promise<T>["catch"]>[0]) =>
    promise.catch(reject);

  return chain;
}

const NOW = new Date("2025-01-01T00:00:00.000Z");

const mockTaskRow = {
  id: "task-uuid-1",
  userId: "user-uuid-1",
  source: "chat",
  taskSummary: "Write a hello world function",
  repo: null,
  branch: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const mockEventRow = {
  id: "evt-uuid-1",
  taskId: "task-uuid-1",
  eventType: "task.started",
  source: "chat",
  payload: {},
  createdAt: NOW,
};

describe("TaskRepository", () => {
  let mockDb: Partial<Db>;
  let repo: TaskRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockTaskRow])),
      select: vi.fn(() => mockChain([mockTaskRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new TaskRepository(mockDb as Db);
  });

  // ─── createTask ──────────────────────────────────────────────────────────────

  describe("createTask", () => {
    it("creates and returns a task", async () => {
      const task = await repo.createTask({
        userId: "user-uuid-1",
        source: "chat",
        taskSummary: "Write a hello world function",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(task.id).toBe("task-uuid-1");
      expect(task.source).toBe("chat");
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.createTask({ userId: "user-uuid-1", source: "chat" }),
      ).rejects.toThrow("Failed to create task");
    });
  });

  // ─── findById ────────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns a task when found", async () => {
      const task = await repo.findById("task-uuid-1");
      expect(task).not.toBeNull();
      expect(task?.id).toBe("task-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const task = await repo.findById("nonexistent");
      expect(task).toBeNull();
    });
  });

  // ─── findByUserId ─────────────────────────────────────────────────────────────

  describe("findByUserId", () => {
    it("returns tasks for a user", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockTaskRow, { ...mockTaskRow, id: "task-uuid-2" }]),
      );
      const userTasks = await repo.findByUserId("user-uuid-1");
      expect(userTasks).toHaveLength(2);
    });

    it("returns empty array when user has no tasks", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const userTasks = await repo.findByUserId("user-uuid-1");
      expect(userTasks).toHaveLength(0);
    });
  });

  // ─── appendEvent ─────────────────────────────────────────────────────────────

  describe("appendEvent", () => {
    it("inserts and returns the event", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockEventRow]),
      );

      const event = await repo.appendEvent({
        taskId: "task-uuid-1",
        eventType: "task.started",
        source: "chat",
        payload: {},
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(event.eventType).toBe("task.started");
      expect(event.taskId).toBe("task-uuid-1");
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.appendEvent({
          taskId: "task-uuid-1",
          eventType: "task.started",
          source: "chat",
          payload: {},
        }),
      ).rejects.toThrow("Failed to append task event");
    });

    it("can append all five v1 event types without error", async () => {
      const eventTypes = [
        "task.started",
        "task.completed",
        "task.failed",
        "task.review_ready",
        "task.no_changes",
      ] as const;

      for (const eventType of eventTypes) {
        (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
          mockChain([{ ...mockEventRow, eventType }]),
        );

        const event = await repo.appendEvent({
          taskId: "task-uuid-1",
          eventType,
          source: "test",
          payload: {},
        });

        expect(event.eventType).toBe(eventType);
      }

      expect(mockDb.insert).toHaveBeenCalledTimes(eventTypes.length);
    });
  });

  // ─── findEventsByTaskId ───────────────────────────────────────────────────────

  describe("findEventsByTaskId", () => {
    it("returns ordered events for a task", async () => {
      const secondEvent = {
        ...mockEventRow,
        id: "evt-uuid-2",
        eventType: "task.completed",
      };
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockEventRow, secondEvent]),
      );

      const events = await repo.findEventsByTaskId("task-uuid-1");
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("task.started");
      expect(events[1].eventType).toBe("task.completed");
    });

    it("returns empty array when task has no events", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const events = await repo.findEventsByTaskId("task-uuid-1");
      expect(events).toHaveLength(0);
    });
  });
});
