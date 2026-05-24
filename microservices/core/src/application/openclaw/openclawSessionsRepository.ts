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

import { and, asc, eq, isNull, sql } from "drizzle-orm";
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
  /**
   * Tier-at-start. Pinned to the row so the idempotent reconnect
   * path computes `expiresAt` against the tier the session
   * started under, not the user's current tier (which may have
   * been downgraded since).
   */
  tier: "free" | "premium" | "enterprise";
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
        tier: input.tier,
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

  /**
   * 0-based position of `sessionId` among the user's active rows when
   * sorted by (started_at ASC, id ASC). Returns -1 if the row isn't
   * in the active set (already stopped, or belongs to another user).
   *
   * Used by the service's compensating TOCTOU check after insert:
   * concurrent same-user creates that both pass the up-front count
   * gate need a deterministic tiebreaker so only the loser rolls
   * back. Without this, BOTH racers see the same post-insert count
   * and BOTH conclude they're over-cap — the user ends up with no
   * sessions instead of one. Ranking by (started_at, id) gives a
   * total order that's stable across both racers' views of the same
   * committed state, so the same row is selected as the loser
   * regardless of which racer evaluates first.
   *
   * `id` is the secondary sort because Postgres timestamps can tie at
   * sub-microsecond precision (especially in tests with a frozen
   * clock); UUIDs are random but deterministic, so the tie-break is
   * stable across both racers.
   */
  async rankAmongActive(userId: string, sessionId: string): Promise<number> {
    const rows = await this.db
      .select({ id: openclawSessions.id })
      .from(openclawSessions)
      .where(
        and(
          eq(openclawSessions.userId, userId),
          isNull(openclawSessions.stoppedAt),
        ),
      )
      .orderBy(asc(openclawSessions.startedAt), asc(openclawSessions.id));
    return rows.findIndex((r) => r.id === sessionId);
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
