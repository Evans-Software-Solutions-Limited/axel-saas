import { waitlistSignupHref } from "@/lib/waitlist";

export type Plan = {
  name: string;
  /**
   * Internal tier ID used for Stripe checkout.
   * `null` for tiers that are not self-serve (Enterprise — contact us).
   */
  tierId: "free" | "premium" | null;
  price: string;
  period: string;
  tagline: string;
  description: string;
  features: string[];
  /** CTA for the pricing card. Defaults to the standard "Get started" flow. */
  ctaLabel?: string;
  ctaHref?: string;
};

export type Recommendation = {
  tierId: "free" | "premium";
  /** Full sentence shown inline below the highlighted card. */
  reason: string;
  /** Short label used in the badge (≤ 4 words). */
  shortReason: string;
};

export type UserSignals = {
  /** Messages from onboarding or chat used to derive a recommendation. */
  messages?: { role: string; content: string }[];
};

export const PLANS: Plan[] = [
  {
    name: "Free",
    tierId: "free",
    price: "£0",
    period: "",
    tagline: "Get started",
    description:
      "Core Axel experience with daily usage caps. 7-day Premium trial available from inside the app.",
    features: [
      "Core Axel experience",
      "Daily usage caps",
      "7-day Premium trial",
    ],
  },
  {
    name: "Premium",
    tierId: "premium",
    price: "£49",
    period: "/month",
    tagline: "Most popular",
    description:
      "Full capability — bring your own model, deeper integrations, higher volume.",
    features: [
      "Everything in Free, without the caps",
      "Bring your own model (BYOM)",
      "Deeper integrations",
      "Higher volume",
      "Cancel any time",
    ],
  },
  {
    name: "Enterprise",
    tierId: null,
    price: "Contact us",
    period: "",
    tagline: "Large organisations",
    description:
      "Security, control, and hands-on support for organisations with real requirements.",
    features: [
      "SSO and audit logs",
      "SLA options",
      "Custom retention",
      "Dedicated support",
    ],
    ctaLabel: "Contact us",
    ctaHref: waitlistSignupHref("enterprise"),
  },
];

/**
 * Keywords that indicate a user needs Premium rather than Free.
 * Matched at word boundaries to avoid substring false positives.
 */
const PREMIUM_KEYWORDS = [
  "api",
  "byom",
  "bring your own model",
  "calendar",
  "code",
  "coding",
  "developer",
  "email",
  "integration",
  "meeting",
  "schedule",
  "sub-agent",
  "team",
  "custom channel",
];

const TIER_REASONS: Record<
  "free" | "premium",
  { reason: string; shortReason: string }
> = {
  premium: {
    reason: "Based on your needs around deeper integrations and higher volume.",
    shortReason: "Based on your needs",
  },
  free: {
    reason: "A great starting point based on what you described.",
    shortReason: "Based on your needs",
  },
};

/**
 * Returns true when `keyword` appears in `text` at a word boundary, preventing
 * substring false positives (e.g. "exec" matching "executive").
 * An optional trailing "s" is allowed so plurals like "teams" or "emails"
 * match their base keyword without re-opening substring false positives.
 * Multi-word phrases are matched as complete boundary-delimited phrases.
 */
function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}s?\\b`).test(text);
}

/**
 * Returns a plan recommendation derived from user signals, or null when no
 * meaningful signals are available.
 *
 * Heuristic: match Premium keywords against user messages. If any match,
 * recommend Premium; otherwise no recommendation is shown (Free is the default
 * entry point and doesn't need a badge).
 */
export function getRecommendedPlan(
  signals?: UserSignals,
): Recommendation | null {
  const userMessages =
    signals?.messages?.filter((m) => m.role === "user") ?? [];
  if (userMessages.length === 0) return null;

  const userText = userMessages.map((m) => m.content.toLowerCase()).join(" ");
  if (!userText.trim()) return null;

  if (PREMIUM_KEYWORDS.some((k) => matchesKeyword(userText, k))) {
    return { tierId: "premium", ...TIER_REASONS.premium };
  }

  return null;
}
