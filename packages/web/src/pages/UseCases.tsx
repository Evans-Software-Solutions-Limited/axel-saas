import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@axel-saas/ui/button";
import { waitlistSignupHref } from "@/lib/waitlist";
import {
  IconBriefcase,
  IconUsers,
  IconCode,
  IconRocket,
} from "@tabler/icons-react";

type SectionCta = { label: string; to: string };

const SECTIONS: ReadonlyArray<{
  title: string;
  icon: React.ComponentType<{ className?: string; stroke?: number }>;
  body: readonly [string, string];
  cta: SectionCta;
}> = [
  {
    title: "The Knowledge Worker",
    icon: IconBriefcase,
    body: [
      "Daily briefs, meeting prep, and task triage — Axel keeps the moving parts in one place so you can focus on the work that needs you.",
      "Start your day knowing what matters.",
    ],
    cta: {
      label: "Join waitlist",
      to: waitlistSignupHref("free"),
    },
  },
  {
    title: "The Operator / Team Lead",
    icon: IconUsers,
    body: [
      "Meeting summaries, async catch-up, and team-wide status without chasing threads in five apps.",
      "Never miss what was decided.",
    ],
    cta: { label: "See plans", to: "/pricing" },
  },
  {
    title: "The Developer",
    icon: IconCode,
    body: [
      "You can go deep when you want — but Axel is your assistant first, not a thin wrapper that assumes you live in YAML. We focus on integrations with tools you already use; a wide-open public API is not how Axel is positioned.",
      "Powerful when you want it — still usable when you don't.",
    ],
    cta: {
      label: "Join waitlist",
      to: waitlistSignupHref("pro"),
    },
  },
  {
    title: "The Solopreneur",
    icon: IconRocket,
    body: [
      "Calendar, comms, and deliverables when you wear every hat. Axel carries the admin so you can ship.",
      "One person. Axel makes it manageable.",
    ],
    cta: {
      label: "Join waitlist",
      to: waitlistSignupHref("free"),
    },
  },
] as const;

function CtaButton({ cta }: Readonly<{ cta: SectionCta }>) {
  return (
    <Link to={cta.to}>
      <Button variant={cta.to === "/pricing" ? "outline" : "default"}>
        {cta.label}
      </Button>
    </Link>
  );
}

export function UseCases() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Use Cases — Axel for Knowledge Workers, Operators, Developers & Solopreneurs"
        description="See how Axel fits your role: daily briefs and meeting prep for knowledge workers, async catch-up for operators, and task management for solopreneurs."
        path="/use-cases"
      />
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 animate-fade-up">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-text mb-5">
              Use cases
            </h1>
            <p className="text-text-secondary text-lg max-w-xl mx-auto">
              See whether Axel fits someone like you — outcomes first, feature
              lists live on pricing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SECTIONS.map(({ title, icon: Icon, body, cta }) => (
              <div
                key={title}
                className="glass-card rounded-2xl p-7 flex flex-col"
              >
                <div className="w-11 h-11 rounded-xl bg-accent-muted flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-accent" stroke={1.5} />
                </div>
                <h2 className="text-xl font-display font-semibold text-text mb-4">
                  {title}
                </h2>
                <div className="space-y-3 text-text-secondary leading-relaxed flex-1 mb-6">
                  <p className="text-sm">{body[0]}</p>
                  <p className="text-sm text-text font-medium">{body[1]}</p>
                </div>
                <CtaButton cta={cta} />
              </div>
            ))}
          </div>

          <div className="text-center mt-16 animate-fade-up">
            <Link to={waitlistSignupHref()}>
              <Button className="px-8">Join waitlist</Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default UseCases;
