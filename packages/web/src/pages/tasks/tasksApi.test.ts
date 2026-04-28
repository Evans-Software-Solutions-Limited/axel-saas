import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTasks, getTaskDetail } from "./tasksApi";

const { api: mockApi } = vi.hoisted(() => ({
  api: {
    core: {
      users: {
        me: {
          tasks: Object.assign(vi.fn(), {
            get: vi.fn(),
          }),
        },
      },
    },
  },
}));

// Eden treaty uses a callable path for params: api.core.users.me.tasks({taskId}).get()
// We model that with a function that returns an object with .get().
mockApi.core.users.me.tasks = Object.assign(
  vi.fn(() => ({ get: vi.fn() })),
  { get: vi.fn() },
) as never;

vi.mock("@/lib/eden", () => ({
  api: mockApi,
}));

describe("tasksApi.getTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tasks on success", async () => {
    (
      mockApi.core.users.me.tasks as unknown as {
        get: ReturnType<typeof vi.fn>;
      }
    ).get.mockResolvedValueOnce({
      data: {
        success: true,
        tasks: [{ id: "1", source: "axel" }],
      },
    });
    const res = await getTasks();
    expect(res).toEqual([{ id: "1", source: "axel" }]);
  });

  it("throws structured error from API error body", async () => {
    (
      mockApi.core.users.me.tasks as unknown as {
        get: ReturnType<typeof vi.fn>;
      }
    ).get.mockResolvedValueOnce({
      data: { success: false, error: "Failed to list tasks" },
    });
    await expect(getTasks()).rejects.toThrow("Failed to list tasks");
  });

  it("throws generic error when response has no body", async () => {
    (
      mockApi.core.users.me.tasks as unknown as {
        get: ReturnType<typeof vi.fn>;
      }
    ).get.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    await expect(getTasks()).rejects.toThrow("Failed to fetch tasks");
  });

  it("extracts message from nested error.message shape", async () => {
    (
      mockApi.core.users.me.tasks as unknown as {
        get: ReturnType<typeof vi.fn>;
      }
    ).get.mockResolvedValueOnce({
      data: null,
      error: { message: "Network fail" },
    });
    await expect(getTasks()).rejects.toThrow("Network fail");
  });
});

describe("tasksApi.getTaskDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns task with events array containing latestEvent", async () => {
    const latest = {
      id: "ev",
      taskId: "t1",
      eventType: "task.completed",
      source: "axel",
      payload: {},
      createdAt: "2026-04-22T00:00:00Z",
    };
    const getMock = vi.fn().mockResolvedValue({
      data: {
        success: true,
        task: { id: "t1", source: "axel", latestEvent: latest },
      },
    });
    (mockApi.core.users.me.tasks as unknown as (args: { taskId: string }) => {
      get: typeof getMock;
    }) = vi.fn(() => ({ get: getMock })) as never;

    const res = await getTaskDetail("t1");
    expect(res.events).toHaveLength(1);
    expect(res.events[0].id).toBe("ev");
  });

  it("returns empty events array when no latest event", async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: {
        success: true,
        task: { id: "t1", source: "axel", latestEvent: null },
      },
    });
    (mockApi.core.users.me.tasks as unknown as (args: { taskId: string }) => {
      get: typeof getMock;
    }) = vi.fn(() => ({ get: getMock })) as never;
    const res = await getTaskDetail("t1");
    expect(res.events).toEqual([]);
  });

  it("throws on error response", async () => {
    const getMock = vi.fn().mockResolvedValue({
      data: { success: false, error: "Task not found" },
    });
    (mockApi.core.users.me.tasks as unknown as (args: { taskId: string }) => {
      get: typeof getMock;
    }) = vi.fn(() => ({ get: getMock })) as never;
    await expect(getTaskDetail("t1")).rejects.toThrow("Task not found");
  });
});
