/**
 * Token budget definitions per subscription tier.
 *
 * Free tier has a daily cap (input + output counted separately) so the
 * platform can fund a useful trial without unbounded spend. Premium has
 * a monthly cap large enough that a heavy user shouldn't realistically
 * hit it, sized to keep margins healthy on the £49 subscription.
 * Enterprise has no cap — it's contracted separately and isn't self-serve.
 *
 * These numbers come from `specs/token-management/design.md`. They live
 * in code rather than in a `usage_caps` table because they only change
 * with a code-level policy decision, not at runtime.
 */

import type { SubscriptionTier } from "../integrations/tierGate";

export interface TokenBudget {
  /** Per-day limits for tiers that enforce daily caps (free). */
  daily?: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Per-month limits for tiers that enforce monthly caps (premium). */
  monthly?: {
    inputTokens: number;
    outputTokens: number;
  };
  /**
   * Soft warning threshold (0–1). When usage crosses this fraction the
   * frontend renders a warning banner. The backend doesn't enforce on
   * this — it's purely a UI hint.
   */
  warningThreshold: number;
}

export const TOKEN_BUDGETS: Record<SubscriptionTier, TokenBudget> = {
  free: {
    daily: {
      inputTokens: 50_000,
      outputTokens: 25_000,
    },
    warningThreshold: 0.8,
  },
  premium: {
    monthly: {
      inputTokens: 2_000_000,
      outputTokens: 1_000_000,
    },
    warningThreshold: 0.8,
  },
  // Enterprise is contracted off-platform; no enforcement here.
  enterprise: {
    warningThreshold: 0.8,
  },
};

export function getBudget(tier: SubscriptionTier | null): TokenBudget {
  // Treat unknown / missing subscription as Free — the safe fallback.
  // If a row is missing entirely (a freshly-confirmed user before
  // /subscriptions/free has fired), we still want to enforce the Free
  // cap so an unauthed-but-onboarded user can't consume unbounded
  // tokens.
  return TOKEN_BUDGETS[tier ?? "free"];
}

/**
 * Rough token estimator used until the OpenClaw gateway returns real
 * usage. Anthropic and OpenAI tokenisers both average ~4 chars/token
 * for English; this is a deliberate over-estimate so we err on the
 * side of capping early. Replace with the gateway-reported value as
 * soon as that contract lands.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
