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

/**
 * Returns a deterministic plan recommendation.
 *
 * Currently defaults to Pro — the tier that covers the most common use cases
 * (calendar + email + task automation) without over-specifying.
 *
 * Future: accept user signals (role, team size, feature interest) for a
 * personalised recommendation without needing AI inference.
 */
export function getRecommendedPlan(): Recommendation {
  return {
    tierId: "pro",
    reason:
      "Covers calendar, email, and task automation — the features most users need from day one.",
    shortReason: "Best starting point",
  };
}
