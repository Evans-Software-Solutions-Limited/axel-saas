/**
 * Routing Classifier
 *
 * Pure, dependency-free functions that implement the first routing execution
 * slice described in docs/nemoclaw-architecture-implications.md.
 *
 * No network calls, no DB access — safe to call synchronously on the hot path.
 */

import type {
  DataClassification,
  RoutingCategory,
  RoutingPolicy,
  SubscriptionTier,
  TaskEnvelope,
} from "./routingTypes";
import { TIER_ROUTING_MATRIX } from "./routingTypes";

// ---------------------------------------------------------------------------
// PII detection patterns (UK-centric, matches the product's target market)
// ---------------------------------------------------------------------------

const PII_PATTERNS: RegExp[] = [
  // Email addresses
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,
  // UK mobile / landline (07xxx, +44 7xxx, 01xxx, 02xxx, 03xxx)
  // Uses lookbehind/lookahead instead of \b because + is not a word character
  /(?<!\d)(?:\+44\s?|0)(?:7\d{3}|\d{2,4})\s?\d{3,4}\s?\d{3,4}(?!\d)/,
  // UK postcodes (e.g. SW1A 1AA, EC1A 1BB, W1A 0AX)
  /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i,
  // National Insurance numbers
  /\b[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]\b/i,
  // Sort codes (12-34-56)
  /\b\d{2}-\d{2}-\d{2}\b/,
  // UK bank account numbers (8 digits, standalone)
  /\b\d{8}\b/,
];

const FINANCIAL_PATTERNS: RegExp[] = [
  // Currency amounts: £1,200 / £12.50 / $500 / €99
  /[£$€]\s?\d[\d,]*(?:\.\d{1,2})?/,
  // "owes £X" / "rent of £X" style phrases
  /(?:owes?|rent|arrears?|balance|invoice|payment)\s+(?:of\s+)?[£$€]?\s?\d/i,
  // Account/reference numbers that look financial (IBAN-style or long numeric refs)
  /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7,}\b/,
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a raw message string for sensitive data.
 *
 * Runs a lightweight regex scan — not a full NLP/ML classifier.  False
 * negatives are possible; this layer is for instrumentation and basic
 * guardrails, not a guarantee of PII-free transmission.
 *
 * Priority order: financial-data > pii-suspected > clean
 */
export function classifyMessage(message: string): DataClassification {
  if (FINANCIAL_PATTERNS.some((p) => p.test(message))) {
    return "financial-data";
  }
  if (PII_PATTERNS.some((p) => p.test(message))) {
    return "pii-suspected";
  }
  return "clean";
}

/**
 * Return the routing policy for a subscription tier.
 * Throws if an unknown tier is supplied (should not happen with typed callers).
 */
export function getRoutingPolicy(tier: SubscriptionTier): RoutingPolicy {
  const policy = TIER_ROUTING_MATRIX[tier];
  if (!policy) {
    throw new Error(`Unknown subscription tier: ${tier}`);
  }
  return policy;
}

/**
 * Resolve the routing category from a data classification and the active
 * tier policy.
 *
 * Decision table:
 *
 * | Classification  | Policy.piiHandling | Permitted? | Result                  |
 * |-----------------|--------------------|------------|-------------------------|
 * | clean           | any                | yes        | cloud-direct            |
 * | anonymized      | any                | yes        | cloud-direct            |
 * | pii-suspected   | refuse             | no         | refused                 |
 * | pii-suspected   | log-only           | yes        | log-and-forward         |
 * | pii-suspected   | anonymize          | yes        | cloud-post-anonymize    |
 * | financial-data  | refuse             | no         | refused                 |
 * | financial-data  | log-only           | no*        | refused (* not allowed) |
 * | financial-data  | anonymize          | yes        | cloud-post-anonymize    |
 *
 * *Pro tier (log-only) does not list financial-data as an allowed classification.
 */
export function resolveRoutingCategory(
  classification: DataClassification,
  policy: RoutingPolicy,
): RoutingCategory {
  // Pre-cleaned or clean messages always take the fast path
  if (classification === "clean" || classification === "anonymized") {
    return "cloud-direct";
  }

  // Check whether this classification is permitted by the tier at all
  if (!policy.allowedDataClassifications.includes(classification)) {
    return "refused";
  }

  // Classification is permitted — apply PII handling mode
  switch (policy.piiHandling) {
    case "refuse":
      return "refused";
    case "log-only":
      return "log-and-forward";
    case "anonymize":
      return "cloud-post-anonymize";
  }
}

/**
 * Build a fully-resolved TaskEnvelope for a single user message.
 *
 * This is the single entry point for callers that want the complete
 * routing context in one call.
 */
export function buildTaskEnvelope(params: {
  userId: string;
  tier: SubscriptionTier;
  rawMessage: string;
  /** Override classification (e.g. after an upstream anonymisation step). */
  dataClassification?: DataClassification;
}): TaskEnvelope {
  const { userId, tier, rawMessage } = params;
  const policy = getRoutingPolicy(tier);
  const dataClassification =
    params.dataClassification ?? classifyMessage(rawMessage);
  const routingCategory = resolveRoutingCategory(dataClassification, policy);

  return {
    userId,
    tier,
    rawMessage,
    dataClassification,
    routingCategory,
    policy,
    createdAt: new Date().toISOString(),
  };
}
