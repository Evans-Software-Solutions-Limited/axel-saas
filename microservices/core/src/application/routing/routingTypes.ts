/**
 * Cost/Privacy Routing Types
 *
 * Implements the policy-based routing matrix described in
 * docs/nemoclaw-architecture-implications.md.
 *
 * Core separation:
 *   1. What data is in a message (DataClassification)
 *   2. What the tier policy permits (RoutingPolicy)
 *   3. What routing decision results (RoutingCategory)
 *   4. The full context envelope passed through the pipeline (TaskEnvelope)
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * Subscription tiers — imported from the repository that derives this type
 * from the DB schema enum, so routing stays in sync with the source of truth
 * automatically.
 */
import type { SubscriptionTier } from "../repositories/subscriptionRepository";
export type { SubscriptionTier };

/**
 * Classification of data present in a user message.
 *
 * - `clean`          No sensitive data detected; safe for direct cloud routing.
 * - `pii-suspected`  PII patterns detected (email, phone, postcode, etc.).
 * - `financial-data` Financial figures / account references detected.
 * - `anonymized`     Message has already been scrubbed by a pre-filter.
 */
export type DataClassification =
  | "clean"
  | "pii-suspected"
  | "financial-data"
  | "anonymized";

/**
 * How a tier handles PII in messages.
 *
 * - `refuse`     Reject the request if sensitive data is detected.
 * - `log-only`   Allow through but record the classification in the audit log.
 * - `anonymize`  Strip / hash identifiers before forwarding to the cloud model.
 */
export type PiiHandlingMode = "refuse" | "log-only" | "anonymize";

// ---------------------------------------------------------------------------
// Routing decision
// ---------------------------------------------------------------------------

/**
 * The routing category resolved from classification + tier policy.
 *
 * - `cloud-direct`          Clean data → forward to cloud model immediately.
 * - `cloud-post-anonymize`  Sensitive data, but tier permits anonymise-then-forward.
 * - `log-and-forward`       Sensitive data, tier logs but still forwards (Pro behaviour).
 * - `refused`               Sensitive data, tier does not permit egress → reject.
 */
export type RoutingCategory =
  | "cloud-direct"
  | "cloud-post-anonymize"
  | "log-and-forward"
  | "refused";

// ---------------------------------------------------------------------------
// Per-tier policy
// ---------------------------------------------------------------------------

/**
 * Routing policy attached to a subscription tier.
 * Defines the hard limits that the routing layer enforces regardless of
 * prompt-level instructions.
 */
export type RoutingPolicy = {
  tier: SubscriptionTier;
  /** Whether this tier may make outbound HTTP calls via agent skills. */
  externalCallsPermitted: boolean;
  /** How PII-bearing messages are handled. */
  piiHandling: PiiHandlingMode;
  /** Which data classifications are allowed through to the cloud model. */
  allowedDataClassifications: DataClassification[];
  /** Whether this tier may escalate to a cloud LLM at all. */
  cloudModelFallback: boolean;
  /** Whether all cloud API calls are written to the audit log. */
  auditLogging: boolean;
};

// ---------------------------------------------------------------------------
// Tier routing matrix
// ---------------------------------------------------------------------------

/**
 * Canonical routing policy per subscription tier.
 *
 * Derived from the tier enforcement table in docs/nemoclaw-architecture-implications.md:
 *
 * | Tier      | Policy                                                              |
 * |-----------|---------------------------------------------------------------------|
 * | Starter   | Pre-approved tools only, no external HTTP, refuse PII               |
 * | Pro       | Extended tools, external HTTP with logging, log-only PII handling   |
 * | Business  | Custom tool allowlist, full audit log, PII anonymisation            |
 * | Developer | Policy-as-code: same caps as Business plus full API access          |
 */
export const TIER_ROUTING_MATRIX: Record<SubscriptionTier, RoutingPolicy> = {
  starter: {
    tier: "starter",
    externalCallsPermitted: false,
    piiHandling: "refuse",
    allowedDataClassifications: ["clean", "anonymized"],
    cloudModelFallback: false,
    auditLogging: false,
  },
  pro: {
    tier: "pro",
    externalCallsPermitted: true,
    piiHandling: "log-only",
    allowedDataClassifications: ["clean", "pii-suspected", "anonymized"],
    cloudModelFallback: true,
    auditLogging: true,
  },
  business: {
    tier: "business",
    externalCallsPermitted: true,
    piiHandling: "anonymize",
    allowedDataClassifications: [
      "clean",
      "pii-suspected",
      "financial-data",
      "anonymized",
    ],
    cloudModelFallback: true,
    auditLogging: true,
  },
  developer: {
    tier: "developer",
    externalCallsPermitted: true,
    piiHandling: "anonymize",
    allowedDataClassifications: [
      "clean",
      "pii-suspected",
      "financial-data",
      "anonymized",
    ],
    cloudModelFallback: true,
    auditLogging: true,
  },
};

// ---------------------------------------------------------------------------
// Task envelope
// ---------------------------------------------------------------------------

/**
 * Metadata wrapper carried alongside a user message through the routing
 * pipeline.  Created once per request; immutable after construction.
 */
export type TaskEnvelope = {
  /** Axel SaaS internal user ID (not the Supabase JWT sub). */
  userId: string;
  tier: SubscriptionTier;
  /** The original, unmodified user message. */
  rawMessage: string;
  dataClassification: DataClassification;
  routingCategory: RoutingCategory;
  policy: RoutingPolicy;
  /** ISO-8601 timestamp set at envelope creation. */
  createdAt: string;
};
