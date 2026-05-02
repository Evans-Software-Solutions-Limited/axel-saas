/**
 * BYOM (Bring Your Own Model) integrations are gated to Premium and
 * Enterprise tiers. The check lives separately from IntegrationService so
 * the connect / OAuth-start handlers can both reuse the same gate without
 * the service needing to know about subscription tiers.
 *
 * Backend enforcement is the source of truth — the frontend hides the
 * "Connect" button for free-tier users on these integrations, but a
 * crafted request must still be rejected here.
 */

export type SubscriptionTier = "free" | "premium" | "enterprise";

const PREMIUM_ONLY_INTEGRATIONS = ["openai", "anthropic"] as const;

export type PremiumOnlyIntegrationId =
  (typeof PREMIUM_ONLY_INTEGRATIONS)[number];

export function isPremiumOnlyIntegration(
  integrationId: string,
): integrationId is PremiumOnlyIntegrationId {
  return (PREMIUM_ONLY_INTEGRATIONS as readonly string[]).includes(
    integrationId,
  );
}

export type TierGateResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export function checkIntegrationTierGate(
  integrationId: string,
  tier: SubscriptionTier | null,
): TierGateResult {
  if (!isPremiumOnlyIntegration(integrationId)) {
    return { allowed: true };
  }
  if (tier === "premium" || tier === "enterprise") {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "This integration requires a Premium subscription",
  };
}
