import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  type Db,
  type TokenUsage,
  type NewTokenUsage,
  tokenUsage,
  getDb,
} from "@axel-saas/db";

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Aggregated usage broken down by model — used by the BYOM-aware UI
 * (deferred for MVP) and by per-model cost attribution.
 */
export interface UsageByModel extends UsageTotals {
  model: string;
  source: string;
}

/** Returns YYYY-MM-DD in UTC. Used as the row's `usage_date` so daily
 *  aggregation is timezone-agnostic. */
export function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export class TokenUsageRepository {
  static readonly key = "TokenUsageRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  /**
   * Upsert + increment. The unique index on (user_id, usage_date, model,
   * source) means we never have multiple rows per user/day/model/source
   * — a single chat message just adds tokens onto today's row.
   */
  async incrementUsage(input: {
    userId: string;
    usageDate: string; // YYYY-MM-DD (UTC)
    model: string;
    source: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd?: string | null;
  }): Promise<TokenUsage> {
    const values: NewTokenUsage = {
      userId: input.userId,
      usageDate: input.usageDate,
      model: input.model,
      source: input.source,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      estimatedCostUsd: input.estimatedCostUsd ?? null,
    };

    const [row] = await this.db
      .insert(tokenUsage)
      .values(values)
      .onConflictDoUpdate({
        target: [
          tokenUsage.userId,
          tokenUsage.usageDate,
          tokenUsage.model,
          tokenUsage.source,
        ],
        set: {
          inputTokens: sql`${tokenUsage.inputTokens} + ${input.inputTokens}`,
          outputTokens: sql`${tokenUsage.outputTokens} + ${input.outputTokens}`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error("Failed to record token usage — no row returned");
    return row;
  }

  /**
   * Sum of input + output tokens for a user on a single UTC day. Used to
   * enforce the Free-tier daily cap.
   */
  async getDailyTotals(
    userId: string,
    usageDate: string,
  ): Promise<UsageTotals> {
    const [row] = await this.db
      .select({
        inputTokens: sql<number>`COALESCE(SUM(${tokenUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${tokenUsage.outputTokens}), 0)::int`,
      })
      .from(tokenUsage)
      .where(
        and(eq(tokenUsage.userId, userId), eq(tokenUsage.usageDate, usageDate)),
      );
    return {
      inputTokens: Number(row?.inputTokens ?? 0),
      outputTokens: Number(row?.outputTokens ?? 0),
    };
  }

  /**
   * Sum across an inclusive date range. Used to enforce the Premium-tier
   * monthly cap (start = first day of the current UTC month).
   */
  async getRangeTotals(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<UsageTotals> {
    const [row] = await this.db
      .select({
        inputTokens: sql<number>`COALESCE(SUM(${tokenUsage.inputTokens}), 0)::int`,
        outputTokens: sql<number>`COALESCE(SUM(${tokenUsage.outputTokens}), 0)::int`,
      })
      .from(tokenUsage)
      .where(
        and(
          eq(tokenUsage.userId, userId),
          gte(tokenUsage.usageDate, fromDate),
          lte(tokenUsage.usageDate, toDate),
        ),
      );
    return {
      inputTokens: Number(row?.inputTokens ?? 0),
      outputTokens: Number(row?.outputTokens ?? 0),
    };
  }
}
