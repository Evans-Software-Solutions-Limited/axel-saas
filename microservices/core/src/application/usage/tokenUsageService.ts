/**
 * Token usage service — the single entry point the chat handler and
 * usage endpoint go through.
 *
 * Responsibilities:
 * 1. Estimate input/output tokens from a message string until the
 *    OpenClaw gateway returns real per-call usage.
 * 2. Check whether a user is at or over their cap before dispatch.
 *    Free is enforced daily, Premium monthly, Enterprise unlimited.
 * 3. Record actual usage after a successful gateway call.
 * 4. Project the user's current usage + limits into a UI-friendly
 *    summary (`getSummary`).
 *
 * Time is injected as `now()` so tests can pin it without freezing the
 * global clock.
 */

import {
  TokenUsageRepository,
  utcDateString,
  type UsageTotals,
} from "./tokenUsageRepository";
import {
  estimateTokens,
  getBudget,
  projectOutputTokens,
  type TokenBudget,
} from "./tokenBudgets";
import type { SubscriptionTier } from "../integrations/tierGate";

export type CapCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: string;
      scope: "daily" | "monthly";
      resetAt: string; // ISO timestamp at which the cap resets
    };

export interface UsageSummary {
  tier: SubscriptionTier;
  daily: {
    inputTokens: number;
    outputTokens: number;
    limits: { inputTokens: number; outputTokens: number } | null;
  };
  monthly: {
    inputTokens: number;
    outputTokens: number;
    limits: { inputTokens: number; outputTokens: number } | null;
  };
  /** Highest of the input/output usage as a fraction of cap (0–1).
   *  `null` for tiers without a cap. */
  percentUsed: number | null;
  /** Mirrors `tokenBudgets.warningThreshold`. UI shows a soft warning
   *  banner once `percentUsed >= warningThreshold`. */
  warningThreshold: number;
}

function startOfMonthUtc(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  return utcDateString(d);
}

function startOfNextDayUtc(now: Date): string {
  const d = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0,
      0,
      0,
      0,
    ),
  );
  return d.toISOString();
}

function startOfNextMonthUtc(now: Date): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );
  return d.toISOString();
}

/**
 * Highest of the two usage/limit ratios. We treat "input cap reached"
 * and "output cap reached" symmetrically — hitting either one stops new
 * messages.
 */
function maxRatio(used: UsageTotals, limits: TokenBudget["daily"]): number {
  if (!limits) return 0;
  const inputRatio =
    limits.inputTokens > 0 ? used.inputTokens / limits.inputTokens : 0;
  const outputRatio =
    limits.outputTokens > 0 ? used.outputTokens / limits.outputTokens : 0;
  return Math.max(inputRatio, outputRatio);
}

export class TokenUsageService {
  private repo: TokenUsageRepository;
  private now: () => Date;

  constructor(deps?: { repo?: TokenUsageRepository; now?: () => Date }) {
    this.repo = deps?.repo ?? new TokenUsageRepository();
    this.now = deps?.now ?? (() => new Date());
  }

  /**
   * Cap check before dispatching to the gateway. `additional` is the
   * estimated input tokens for the about-to-be-sent message — it's
   * added to today's usage so a user who's already at 99% can't send a
   * 10k-token message and only fail after the fact.
   */
  async checkCap(
    userId: string,
    tier: SubscriptionTier | null,
    additional: { inputTokens: number; outputTokens: number },
  ): Promise<CapCheckResult> {
    const budget = getBudget(tier);
    const now = this.now();

    if (budget.daily) {
      const today = utcDateString(now);
      const used = await this.repo.getDailyTotals(userId, today);
      const projected: UsageTotals = {
        inputTokens: used.inputTokens + additional.inputTokens,
        outputTokens: used.outputTokens + additional.outputTokens,
      };
      if (
        projected.inputTokens >= budget.daily.inputTokens ||
        projected.outputTokens >= budget.daily.outputTokens
      ) {
        return {
          allowed: false,
          reason: "Daily token limit reached",
          scope: "daily",
          resetAt: startOfNextDayUtc(now),
        };
      }
    }

    if (budget.monthly) {
      const monthStart = startOfMonthUtc(now);
      const today = utcDateString(now);
      const used = await this.repo.getRangeTotals(userId, monthStart, today);
      const projected: UsageTotals = {
        inputTokens: used.inputTokens + additional.inputTokens,
        outputTokens: used.outputTokens + additional.outputTokens,
      };
      if (
        projected.inputTokens >= budget.monthly.inputTokens ||
        projected.outputTokens >= budget.monthly.outputTokens
      ) {
        return {
          allowed: false,
          reason: "Monthly token limit reached",
          scope: "monthly",
          resetAt: startOfNextMonthUtc(now),
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record actual usage after a successful gateway call. Idempotent on
   * the SQL side via `(user, date, model, source)` upsert.
   */
  async recordUsage(input: {
    userId: string;
    inputTokens: number;
    outputTokens: number;
    model?: string;
    source?: string;
    estimatedCostUsd?: string | null;
  }): Promise<void> {
    if (input.inputTokens <= 0 && input.outputTokens <= 0) return;
    await this.repo.incrementUsage({
      userId: input.userId,
      usageDate: utcDateString(this.now()),
      model: input.model ?? "unknown",
      source: input.source ?? "chat",
      inputTokens: Math.max(0, Math.floor(input.inputTokens)),
      outputTokens: Math.max(0, Math.floor(input.outputTokens)),
      estimatedCostUsd: input.estimatedCostUsd ?? null,
    });
  }

  /**
   * Project the user's current usage into a UI-friendly summary.
   * Free / Premium fill in the relevant scope; the other scope's
   * `limits` is null. Enterprise has both as null.
   */
  async getSummary(
    userId: string,
    tier: SubscriptionTier | null,
  ): Promise<UsageSummary> {
    const resolvedTier: SubscriptionTier = tier ?? "free";
    const budget = getBudget(resolvedTier);
    const now = this.now();

    const today = utcDateString(now);
    const monthStart = startOfMonthUtc(now);

    const [dailyTotals, monthlyTotals] = await Promise.all([
      this.repo.getDailyTotals(userId, today),
      this.repo.getRangeTotals(userId, monthStart, today),
    ]);

    const dailyRatio = maxRatio(dailyTotals, budget.daily);
    const monthlyRatio = maxRatio(monthlyTotals, budget.monthly);
    const hasAnyCap = !!budget.daily || !!budget.monthly;

    return {
      tier: resolvedTier,
      daily: {
        inputTokens: dailyTotals.inputTokens,
        outputTokens: dailyTotals.outputTokens,
        limits: budget.daily ?? null,
      },
      monthly: {
        inputTokens: monthlyTotals.inputTokens,
        outputTokens: monthlyTotals.outputTokens,
        limits: budget.monthly ?? null,
      },
      percentUsed: hasAnyCap ? Math.max(dailyRatio, monthlyRatio) : null,
      warningThreshold: budget.warningThreshold,
    };
  }
}

/**
 * Convenience wrapper around the estimator so handlers don't need to
 * import from `tokenBudgets` directly.
 */
export function estimateMessageTokens(text: string): number {
  return estimateTokens(text);
}

/**
 * Conservative output projection used at cap-check time. The chat
 * handler doesn't know the response length up front; we project
 * `5 × estimatedInput` (with a 200-token floor) so a tiny prompt
 * that produces a long response can't slip past the cap.
 *
 * Re-exported here so the chat handler imports a single module.
 */
export function projectMessageOutputTokens(
  estimatedInputTokens: number,
): number {
  return projectOutputTokens(estimatedInputTokens);
}
