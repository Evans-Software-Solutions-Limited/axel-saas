import { waitlistSignupHref } from "@/lib/waitlist";

/** Public marketing tiers — aligned with docs/logged-out/messaging-strategy.md.
 * In-app checkout may still use separate internal plan IDs (see planRecommendation). */
export type PublicTier = {
  id: string;
  name: string;
  price: string;
  period: string;
  targetUser: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaExternal?: boolean;
};

export const PUBLIC_TIERS: PublicTier[] = [
  {
    id: "free",
    name: "Free",
    price: "£0",
    period: "",
    targetUser: "Individuals evaluating; light personal use",
    description:
      "Everything you need to meet Axel. Limits apply on volume and sub-agents.",
    features: [
      "Core Axel experience",
      "Briefs and light automation",
      "Activate a 7-day Premium trial from inside the app",
    ],
    ctaLabel: "Join waitlist",
    ctaHref: waitlistSignupHref("free"),
    ctaExternal: false,
  },
  {
    id: "premium",
    name: "Premium",
    price: "£49",
    period: "/month",
    targetUser: "Professionals wanting full Axel capability",
    description:
      "Full calendar, comms, orchestration, and the features serious daily use needs.",
    features: [
      "Everything in Free, without the same caps",
      "Bring your own model (BYOM)",
      "Deeper integrations and higher volume",
      "Cancel any time",
    ],
    ctaLabel: "Join waitlist",
    ctaHref: waitlistSignupHref("pro"),
    ctaExternal: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Contact us",
    period: "",
    targetUser: "Teams, integrations, SSO, custom data retention",
    description:
      "Security, control, and hands-on support for organisations with real requirements.",
    features: [
      "SSO and audit logs",
      "SLA options",
      "Custom retention and data controls",
      "Dedicated support",
    ],
    ctaLabel: "Join waitlist",
    ctaHref: waitlistSignupHref("enterprise"),
    ctaExternal: false,
  },
];
