import { desc, eq } from "drizzle-orm";
import {
  type Db,
  type Task,
  type NewTask,
  type TaskEvent,
  type NewTaskEvent,
  tasks,
  taskEvents,
  getDb,
} from "@axel-saas/db";

export class TaskRepository {
  static readonly key = "TaskRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async createTask(input: NewTask): Promise<Task> {
    const [row] = await this.db.insert(tasks).values(input).returning();
    if (!row) throw new Error("Failed to create task — no row returned");
    return row;
  }

  async findById(taskId: string): Promise<Task | null> {
    const [row] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    return row ?? null;
  }

  async findByUserId(userId: string): Promise<Task[]> {
    return this.db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .orderBy(desc(tasks.createdAt));
  }

  async appendEvent(input: NewTaskEvent): Promise<TaskEvent> {
    const [row] = await this.db.insert(taskEvents).values(input).returning();
    if (!row) throw new Error("Failed to append task event — no row returned");
    return row;
  }

  async findEventsByTaskId(taskId: string): Promise<TaskEvent[]> {
    return this.db
      .select()
      .from(taskEvents)
      .where(eq(taskEvents.taskId, taskId))
      .orderBy(taskEvents.createdAt);
  }
}
