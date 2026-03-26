import Elysia from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { userRepository } from "../repositories/userRepository";
import { TaskRepository } from "./taskRepository";
import { buildProjection } from "./taskStateProjector";

const taskRepo = new TaskRepository();

export const taskHandler = new Elysia({ name: "TaskHandler" })
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/users/me/tasks",
    async (ctx) => {
      const { set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        const userTasks = await taskRepo.findByUserId(dbUser.id);

        // Build projections for each task (events fetched per-task).
        // For v1 this is acceptable — if task volume grows a batched query is
        // the next step (fetch all events in one query and group by task_id).
        const projections = await Promise.all(
          userTasks.map(async (task) => {
            const events = await taskRepo.findEventsByTaskId(task.id);
            const projection = buildProjection(task.id, events);
            return {
              ...task,
              state: projection.state,
              isTerminal: projection.isTerminal,
              eventCount: projection.eventCount,
            };
          }),
        );

        return { success: true, tasks: projections };
      } catch (error) {
        console.error("List tasks error:", error);
        set.status = 500;
        return { success: false, error: "Failed to list tasks" };
      }
    },
    {
      detail: {
        description:
          "List tasks for the authenticated user with projected state",
        tags: ["Tasks"],
      },
    },
  )
  .get(
    "/users/me/tasks/:taskId",
    async (ctx) => {
      const { set, params } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        const task = await taskRepo.findById(params.taskId);
        if (!task || task.userId !== dbUser.id) {
          set.status = 404;
          return { success: false, error: "Task not found" };
        }

        const events = await taskRepo.findEventsByTaskId(task.id);
        const projection = buildProjection(task.id, events);

        return {
          success: true,
          task: {
            ...task,
            state: projection.state,
            isTerminal: projection.isTerminal,
            eventCount: projection.eventCount,
            latestEvent: projection.latestEvent,
          },
        };
      } catch (error) {
        console.error("Get task error:", error);
        set.status = 500;
        return { success: false, error: "Failed to get task" };
      }
    },
    {
      detail: {
        description: "Get a single task with projected state and latest event",
        tags: ["Tasks"],
      },
    },
  );
