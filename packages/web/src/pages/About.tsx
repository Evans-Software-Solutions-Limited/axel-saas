import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@axel-saas/ui/button";
import { waitlistSignupHref } from "@/lib/waitlist";

const SECTIONS = [
  {
    heading: "The problem",
    body: "Professionals are drowning in tool sprawl — a different app for every task, and none of them aware of each other. You spend the day switching context instead of finishing work.",
  },
  {
    heading: "A crowded landscape",
    body: (
      <>
        There are multiple wrappers around OpenClaw and plenty of AI agents
        where you need to read docs, wire APIs, and think like a technical
        operator. That&apos;s legitimate — but it leaves most people behind.
        Axel is different: a personal assistant for{" "}
        <span className="text-text font-medium">anyone</span>, whether you live
        in a terminal or you&apos;ve never opened one.
      </>
    ),
  },
  {
    heading: "What we believe",
    body: "One capable, context-aware assistant beats ten disconnected ones. You should have one place that knows your calendar, your comms, and your priorities — not a dozen tabs that don't talk.",
  },
  {
    heading: "Personal assistant first",
    body: "Axel is here to brief you, capture meetings, chase follow-ups, and keep your day coherent — the way a great PA would. Technical users can go deeper when they want to; non-technical users should never need a manual to get value.",
  },
  {
    heading: "Integrations, not a public API product",
    body: "We're investing in integrations with the tools you already use. Axel is not positioned as a broad, bring-your-own-API platform — if you need raw programmatic access above all else, we're probably not the right fit today.",
  },
  {
    heading: "Where Axel comes from",
    body: (
      <>
        Axel is the consumer face of{" "}
        <a
          href="https://openclaw.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline underline-offset-4"
        >
          OpenClaw
        </a>{" "}
        — the same engine, made approachable. We&apos;re a separate product, not
        affiliated with the OpenClaw project itself, but we build in the open
        and give credit where it&apos;s due.
      </>
    ),
  },
  {
    heading: "Hosted solutions",
    body: (
      <>
        We also offer hosted deployments for organisations that need a managed
        Axel environment — scoped, priced per engagement. If that&apos;s you,
        reach out at{" "}
        <a
          href="mailto:admin@evans-software-solutions.com?subject=Hosted%20Axel"
          className="text-accent hover:underline underline-offset-4"
        >
          admin@evans-software-solutions.com
        </a>{" "}
        and we&apos;ll talk it through.
      </>
    ),
  },
  {
    heading: "How we build",
    body: "Privacy-first, honest about what AI can and can't do, and focused on long-term use — not viral growth hacks. We'd rather you trust Axel for years than click once and churn.",
  },
  {
    heading: "Who we are",
    body: (
      <>
        Small team, big standards. If something breaks your trust, we want to
        hear it — reach us at{" "}
        <a
          href="mailto:admin@evans-software-solutions.com"
          className="text-accent hover:underline underline-offset-4"
        >
          admin@evans-software-solutions.com
        </a>
        .
      </>
    ),
  },
] as const;

export function About() {
  return (
    <MarketingLayout>
      <PageMeta
        title="About Axel — Why We Built an AI PA for Everyone"
        description="Axel exists to end tool sprawl. One context-aware AI assistant built on OpenClaw — approachable for anyone, deep enough for developers."
        path="/about"
      />
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text mb-14 animate-fade-up">
            Why Axel exists
          </h1>

          <div className="space-y-12 leading-relaxed">
            {SECTIONS.map(({ heading, body }) => (
              <div key={heading} className="flex gap-5 animate-fade-up">
                <div className="w-0.5 bg-gradient-to-b from-accent/40 to-transparent rounded-full shrink-0 mt-1" />
                <div>
                  <h2 className="text-xl font-display font-semibold text-text mb-3">
                    {heading}
                  </h2>
                  <p className="text-text-secondary">{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-14 animate-fade-up">
            <Link to={waitlistSignupHref()}>
              <Button className="px-8">Join waitlist</Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default About;
