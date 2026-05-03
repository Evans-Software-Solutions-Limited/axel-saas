import { api } from "@/lib/eden";

export type UsageTier = "free" | "premium" | "enterprise";

export interface UsageSummary {
  tier: UsageTier;
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
  /** 0–1 fraction of cap used; null for tiers without a cap. */
  percentUsed: number | null;
  warningThreshold: number;
}

/**
 * Fetch the current user's token usage + tier limits. Throws on transport
 * failure so the caller can render an error state. A 404 (user-row not
 * yet provisioned, e.g. fresh sign-up before /subscriptions/free fires)
 * is surfaced as `null` so the UI can render the empty state cleanly.
 */
export async function fetchUsageSummary(): Promise<UsageSummary | null> {
  const response = await api.core.users.me.usage.get();
  if (response.error) {
    if (response.error.status === 404) return null;
    throw new Error(`Failed to fetch usage (${response.error.status})`);
  }
  const body = response.data as {
    success: boolean;
    usage?: UsageSummary;
  } | null;
  if (!body?.success || !body.usage) {
    throw new Error("Usage response was not successful");
  }
  return body.usage;
}
