import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@axel-saas/ui/button";
import { waitlistSignupHref } from "@/lib/waitlist";

type SectionCta = { label: string; to: string };

const SECTIONS: ReadonlyArray<{
  title: string;
  body: readonly [string, string];
  cta: SectionCta;
}> = [
  {
    title: "The Knowledge Worker",
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
    body: [
      "Meeting summaries, async catch-up, and team-wide status without chasing threads in five apps.",
      "Never miss what was decided.",
    ],
    cta: { label: "See plans", to: "/pricing" },
  },
  {
    title: "The Developer",
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
      <Button
        variant={cta.to === "/pricing" ? "outline" : "default"}
        className={
          cta.to === "/pricing"
            ? "border-border text-text hover:bg-surface-raised"
            : "bg-accent hover:bg-accent/90 text-white"
        }
      >
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
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-4xl font-bold text-text mb-4">Use cases</h1>
            <p className="text-muted text-lg">
              See whether Axel fits someone like you — outcomes first, feature
              lists live on pricing.
            </p>
          </div>

          <div className="space-y-14">
            {SECTIONS.map(({ title, body, cta }) => (
              <div
                key={title}
                className="border-b border-border pb-14 last:border-0 last:pb-0"
              >
                <h2 className="text-2xl font-semibold text-text mb-4">
                  {title}
                </h2>
                <div className="space-y-3 text-muted leading-relaxed">
                  <p>{body[0]}</p>
                  <p className="text-text font-medium">{body[1]}</p>
                </div>
                <div className="mt-6">
                  <CtaButton cta={cta} />
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-16">
            <Link to={waitlistSignupHref()}>
              <Button className="bg-accent hover:bg-accent/90 text-white px-8">
                Join waitlist
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default UseCases;
