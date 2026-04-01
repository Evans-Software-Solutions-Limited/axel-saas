import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { PageMeta } from "@/components/PageMeta";
import { Button } from "@axel-saas/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axel-saas/ui/card";
import { IconCheck } from "@tabler/icons-react";
import { PUBLIC_TIERS } from "./publicPricing";
import { RELEASE_EXPECTATION_COPY } from "@/lib/waitlist";

function TierCta({
  label,
  href,
  external,
  highlight,
}: Readonly<{
  label: string;
  href: string;
  external?: boolean;
  highlight?: boolean;
}>) {
  const btn = highlight ? (
    <Button type="button" className="w-full h-12 text-sm font-semibold tracking-wide">
      {label}
    </Button>
  ) : (
    <Button type="button" variant="outline" className="w-full h-12 text-sm font-medium tracking-wide">
      {label}
    </Button>
  );

  if (external) {
    return (
      <a href={href} className="block">
        {btn}
      </a>
    );
  }

  return (
    <Link to={href} className="block">
      {btn}
    </Link>
  );
}

export function Pricing() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Pricing — Axel AI Personal Assistant"
        description="Free, Premium (£49/month), and Enterprise plans. 7-day Premium trial — no card required. Join the waitlist for early access."
        path="/pricing"
      />
      <section className="py-20 px-4 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-text mb-5 animate-fade-up stagger-1">
              Pricing
            </h1>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto leading-relaxed animate-fade-up stagger-2">
              We&apos;re opening in stages. {RELEASE_EXPECTATION_COPY} Join the
              waitlist for access. Premium is £49/month — Free users can
              activate a 7-day trial from inside the app. Enterprise and hosted
              solutions are a conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-up stagger-3 pt-5">
            {PUBLIC_TIERS.map((tier, i) => {
              const isHighlight = i === 1;
              return (
                <div key={tier.id} className="relative flex flex-col">
                  {isHighlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="bg-gradient-to-r from-accent to-accent-light text-[#08090d] text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                        Most popular
                      </span>
                    </div>
                  )}
                  <Card
                    className={`flex flex-col flex-1 transition-all duration-300 ${
                      isHighlight
                        ? "border-accent/30 shadow-[0_0_40px_-8px_var(--color-accent-glow)]"
                        : ""
                    }`}
                  >
                  <CardHeader className="px-8 pt-8">
                    <CardTitle className="text-text text-xl font-display">
                      {tier.name}
                    </CardTitle>
                    <CardDescription className="text-muted text-xs font-medium uppercase tracking-wider">
                      {tier.targetUser}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 px-8 pb-8">
                    <div className="mb-4">
                      <div className="text-3xl font-display font-bold text-text">
                        {tier.price}
                        {tier.period ? (
                          <span className="text-sm text-text-secondary font-normal ml-1">
                            {tier.period}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary mb-5 leading-relaxed">
                      {tier.description}
                    </p>
                    <ul className="space-y-3 mb-6 flex-1">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <div className="w-4 h-4 rounded-full bg-accent/10 flex items-center justify-center mt-0.5 flex-shrink-0">
                            <IconCheck className="w-2.5 h-2.5 text-accent" />
                          </div>
                          <span className="text-sm text-text">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <TierCta
                      label={tier.ctaLabel}
                      href={tier.ctaHref}
                      external={tier.ctaExternal}
                      highlight={isHighlight}
                    />
                  </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>

          <div className="max-w-2xl mx-auto mt-14 glass-card rounded-2xl p-8 text-center">
            <h2 className="text-lg font-display font-semibold text-text mb-3">
              Hosted deployments
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              Need Axel in a dedicated, managed environment? We offer hosted
              solutions scoped to your organisation — pricing depends on
              requirements. Tell us what you need.
            </p>
            <a
              href="mailto:admin@evans-software-solutions.com?subject=Hosted%20Axel"
              className="inline-flex text-accent font-medium hover:underline underline-offset-4 text-sm"
            >
              admin@evans-software-solutions.com
            </a>
          </div>

          <div className="max-w-2xl mx-auto mt-12 text-center text-sm text-muted">
            <p>Cancel any time. No questions asked.</p>
          </div>

          <div className="max-w-2xl mx-auto mt-16">
            <h2 className="text-2xl font-display font-bold text-text mb-8 text-center">
              Common questions
            </h2>
            <div className="space-y-0">
              {[
                {
                  q: "What are the Free tier limits?",
                  a: "Free is for meeting Axel and light personal use. We cap volume and sub-agents so expectations stay honest — upgrade when you outgrow them.",
                },
                {
                  q: "How do I get access?",
                  a: `Join the waitlist. ${RELEASE_EXPECTATION_COPY} We'll invite people in batches as we scale capacity.`,
                },
                {
                  q: "How does the Premium trial work?",
                  a: "Free users can activate a 7-day Premium trial from inside the app — no card required until the trial ends. You're never hit with a paywall at signup.",
                },
                {
                  q: "What does Enterprise include?",
                  a: "SSO, audit logs, SLA options, custom retention, integrations, and dedicated support.",
                },
              ].map(({ q, a }) => (
                <div
                  key={q}
                  className="py-6 border-b border-border-subtle last:border-0"
                >
                  <h3 className="text-text font-display font-semibold mb-2">
                    {q}
                  </h3>
                  <p className="text-text-secondary text-sm leading-relaxed">
                    {a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default Pricing;
