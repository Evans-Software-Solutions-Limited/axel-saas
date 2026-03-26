export type Plan = {
  name: string;
  tierId: string | null;
  price: string;
  period: string;
  tagline: string;
  description: string;
  features: string[];
};

export type Recommendation = {
  tierId: string;
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
    name: "Starter",
    tierId: "starter",
    price: "£19",
    period: "/month",
    tagline: "Get organised",
    description:
      "For individuals who want a daily brief and simple task tracking over Telegram.",
    features: [
      "Daily brief",
      "Telegram integration",
      "Basic task automation",
      "Email triage",
    ],
  },
  {
    name: "Pro",
    tierId: "pro",
    price: "£49",
    period: "/month",
    tagline: "Most popular",
    description:
      "For busy professionals who need calendar, email, and task automation in one place.",
    features: [
      "Everything in Starter",
      "Calendar management",
      "Email send/receive",
      "Integrations",
      "Sub-agents",
    ],
  },
  {
    name: "Business",
    tierId: "business",
    price: "£99",
    period: "/month",
    tagline: "Scale your team",
    description:
      "For teams running multiple workflows or needing custom channel support.",
    features: [
      "Everything in Pro",
      "Custom channels",
      "Multiple agents",
      "Priority support",
    ],
  },
  {
    name: "Developer",
    tierId: "developer",
    price: "£149",
    period: "/month",
    tagline: "For builders",
    description:
      "For technical users who need API access, automation scripts, and deep integrations.",
    features: [
      "Everything in Business",
      "Full exec access",
      "Code generation",
      "API access",
      "Heavy sub-agent use",
    ],
  },
  {
    name: "Enterprise",
    tierId: null,
    price: "Custom",
    period: "",
    tagline: "Large organisations",
    description:
      "For organisations needing custom SLAs, deployment, and compliance controls.",
    features: [
      "Everything in Developer",
      "Full deployment",
      "Custom integrations",
      "MCP knowledge integrations",
      "SLA guarantee",
      "Custom contracts",
    ],
  },
];

// Tiers checked in priority order (most specific / highest-value first).
const TIER_KEYWORDS: Array<{ tierId: string; keywords: string[] }> = [
  {
    tierId: "developer",
    keywords: [
      "api",
      "code",
      "coding",
      "developer",
      "script",
      "technical",
      "programming",
      "exec",
    ],
  },
  {
    tierId: "business",
    keywords: [
      "team",
      "company",
      "organisation",
      "organization",
      "employees",
      "custom channel",
      "multiple agent",
    ],
  },
  {
    tierId: "pro",
    keywords: [
      "calendar",
      "email",
      "integration",
      "meeting",
      "schedule",
      "sub-agent",
    ],
  },
  {
    tierId: "starter",
    keywords: [
      "simple",
      "basic",
      "telegram",
      "daily brief",
      "organised",
      "organized",
    ],
  },
];

const TIER_REASONS: Record<string, { reason: string; shortReason: string }> = {
  developer: {
    reason: "Based on your interest in API access and code automation.",
    shortReason: "Based on your needs",
  },
  business: {
    reason: "Based on your team-scale needs.",
    shortReason: "Based on your needs",
  },
  pro: {
    reason: "Based on your calendar, email, and task automation needs.",
    shortReason: "Based on your needs",
  },
  starter: {
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
 * Accepts optional onboarding/chat messages and matches tier keywords against
 * user message content to produce a signal-driven recommendation without AI
 * inference. Returns null when there are no user messages to draw from — the
 * recommendation badge is only shown when it has real context behind it.
 */
export function getRecommendedPlan(
  signals?: UserSignals,
): Recommendation | null {
  const userMessages =
    signals?.messages?.filter((m) => m.role === "user") ?? [];
  if (userMessages.length === 0) return null;

  const userText = userMessages.map((m) => m.content.toLowerCase()).join(" ");
  if (!userText.trim()) return null;

  for (const { tierId, keywords } of TIER_KEYWORDS) {
    if (keywords.some((k) => matchesKeyword(userText, k))) {
      return { tierId, ...TIER_REASONS[tierId] };
    }
  }

  return null;
}
