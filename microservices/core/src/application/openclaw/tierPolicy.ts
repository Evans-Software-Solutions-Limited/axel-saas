/**
 * OpenClaw session tier policy.
 *
 * Source of truth for: per-user concurrency caps, Fargate task sizing,
 * wall-clock hard caps, and the commercial → OpenClaw tier vocabulary
 * mapping the container expects in `AXEL_TIER`.
 *
 * Spec reference: `docs/openclaw-fargate-spec.md` §7.5.
 *
 * Centralised here (rather than embedded in the service) so the
 * Phase 6 reaper Lambda can import the same table without pulling
 * the rest of the service surface.
 *
 * ## Tier vocabulary
 *
 * The spec §7.5 calls out a historical mismatch between the
 * commercial vocabulary (`free|premium|enterprise`) and an older
 * OpenClaw runtime vocabulary (`starter|pro|business|developer`). As
 * of `docker/openclaw/workspace-templates/openclaw-{free,premium,
 * enterprise}.json` the templates use the commercial vocabulary
 * directly, so the mapping is currently the identity function. The
 * indirection is kept here so the next OpenClaw vocabulary drift
 * lands as a one-file change rather than a hunt across handlers.
 */

import type { SubscriptionTier } from "../integrations/tierGate";

export type OpenclawTier = SubscriptionTier; // identity for now, see header

export interface TierPolicy {
  /** Max concurrent ACTIVE (stopped_at IS NULL) sessions per user. */
  maxConcurrentSessions: number;
  /** Fargate CPU units (1024 = 1 vCPU). */
  cpu: number;
  /** Fargate memory in MiB. */
  memoryMib: number;
  /** Hard wall-clock cap — reaper kills tasks older than this. */
  wallClockMs: number;
  /** Task definition key in the SSM-published `task-definition-arns` JSON map. */
  taskDefinitionKey: "free" | "premium" | "enterprise";
}

const HOUR_MS = 60 * 60 * 1000;

const POLICIES: Record<SubscriptionTier, TierPolicy> = {
  free: {
    maxConcurrentSessions: 1,
    cpu: 512,
    memoryMib: 1024,
    wallClockMs: 1 * HOUR_MS,
    taskDefinitionKey: "free",
  },
  premium: {
    maxConcurrentSessions: 2,
    cpu: 1024,
    memoryMib: 2048,
    wallClockMs: 8 * HOUR_MS,
    taskDefinitionKey: "premium",
  },
  enterprise: {
    maxConcurrentSessions: 10,
    cpu: 2048,
    memoryMib: 4096,
    wallClockMs: 24 * HOUR_MS,
    taskDefinitionKey: "enterprise",
  },
};

export function getTierPolicy(tier: SubscriptionTier): TierPolicy {
  return POLICIES[tier];
}

/**
 * Map a commercial tier value to the string the OpenClaw container
 * expects in `AXEL_TIER`. Currently identity; see header for why the
 * indirection exists.
 */
export function mapTierForOpenclaw(tier: SubscriptionTier): OpenclawTier {
  return tier;
}

/**
 * Default tier when the user has no subscription row yet. Anyone
 * authenticated but unsubscribed is treated as `free` — matches the
 * "Free tier provisioning" pattern in the existing subscriptions
 * service.
 */
export const DEFAULT_TIER: SubscriptionTier = "free";

export function resolveTier(
  tier: SubscriptionTier | null | undefined,
): SubscriptionTier {
  return tier ?? DEFAULT_TIER;
}
