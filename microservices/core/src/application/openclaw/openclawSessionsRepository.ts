/**
 * OpenClaw sessions repository.
 *
 * One row per session attempt — never delete on stop, just set
 * `stoppedAt` + `stoppedReason`. The partial unique index on
 * `lower(name) WHERE stopped_at IS NULL` (migration 0013) enforces
 * the name-uniqueness contract across active sessions only; this
 * repository must therefore filter on `stoppedAt IS NULL` whenever
 * resolving by name.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import {
  type Db,
  type OpenclawSession,
  openclawSessions,
  getDb,
} from "@axel-saas/db";

export type OpenclawStoppedReason = "user" | "reaper" | "error" | "tier_change";

export interface CreateOpenclawSessionInput {
  /**
   * Optional explicit row ID — when present, the insert uses it
   * instead of letting the DB generate one. The service generates the
   * sessionId up front (so it can flow into ECS task tags and the
   * target-group name BEFORE the row exists) and threads it through
   * here so the returned `sessionId` from the API matches the row
   * the row that `DELETE /openclaw/sessions/:id` later resolves.
   */
  id?: string;
  userId: string;
  name: string;
  taskArn: string;
  targetGroupArn: string;
  listenerRuleArn: string;
  efsAccessPointId: string;
}

export class OpenclawSessionsRepository {
  static readonly key = "OpenclawSessionsRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async create(input: CreateOpenclawSessionInput): Promise<OpenclawSession> {
    const [row] = await this.db
      .insert(openclawSessions)
      .values({
        ...(input.id ? { id: input.id } : {}),
        userId: input.userId,
        name: input.name,
        taskArn: input.taskArn,
        targetGroupArn: input.targetGroupArn,
        listenerRuleArn: input.listenerRuleArn,
        efsAccessPointId: input.efsAccessPointId,
      })
      .returning();
    if (!row) {
      throw new Error("Failed to insert openclaw session row");
    }
    return row;
  }

  /** Find an active session by case-insensitive name. */
  async findActiveByName(name: string): Promise<OpenclawSession | null> {
    const [row] = await this.db
      .select()
      .from(openclawSessions)
      .where(
        and(
          eq(sql`lower(${openclawSessions.name})`, name.toLowerCase()),
          isNull(openclawSessions.stoppedAt),
        ),
      )
      .limit(1);
    return row || null;
  }

  async findById(id: string): Promise<OpenclawSession | null> {
    const [row] = await this.db
      .select()
      .from(openclawSessions)
      .where(eq(openclawSessions.id, id))
      .limit(1);
    return row || null;
  }

  async listActiveByUserId(userId: string): Promise<OpenclawSession[]> {
    return this.db
      .select()
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.userId, userId),
          isNull(openclawSessions.stoppedAt),
        ),
      );
  }

  async countActiveByUserId(userId: string): Promise<number> {
    const rows = await this.db
      .select({ id: openclawSessions.id })
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.userId, userId),
          isNull(openclawSessions.stoppedAt),
        ),
      );
    return rows.length;
  }

  /**
   * Reuse a prior user's EFS access point: lookup the most recent
   * row (active or stopped) for the user and return its
   * `efsAccessPointId`. Returns null if the user has never had a
   * session — the service will then create a fresh access point.
   */
  async findLastEfsAccessPointId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ efsAccessPointId: openclawSessions.efsAccessPointId })
      .from(openclawSessions)
      .where(eq(openclawSessions.userId, userId))
      .orderBy(sql`${openclawSessions.startedAt} desc`)
      .limit(1);
    return row?.efsAccessPointId ?? null;
  }

  async markStopped(
    id: string,
    reason: OpenclawStoppedReason,
    stoppedAt: Date = new Date(),
  ): Promise<void> {
    await this.db
      .update(openclawSessions)
      .set({ stoppedAt, stoppedReason: reason })
      .where(eq(openclawSessions.id, id));
  }
}
