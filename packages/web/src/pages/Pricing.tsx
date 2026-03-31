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
  featured,
}: Readonly<{
  label: string;
  href: string;
  external?: boolean;
  featured?: boolean;
}>) {
  const className = featured
    ? "w-full bg-accent-strong hover:bg-accent-strong/90 text-white shadow-lg shadow-accent-strong/20 transition-all duration-200"
    : "w-full bg-surface-elevated hover:bg-surface-elevated/80 text-text border border-border hover:border-accent/30 transition-all duration-200";

  if (external) {
    return (
      <a href={href} className="block">
        <Button type="button" className={className}>
          {label}
        </Button>
      </a>
    );
  }

  return (
    <Link to={href} className="block">
      <Button type="button" className={className}>
        {label}
      </Button>
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
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h1 className="text-4xl md:text-5xl font-bold text-text mb-5 tracking-tight">
              Pricing
            </h1>
            <p className="text-muted text-lg max-w-2xl mx-auto leading-relaxed">
              We&apos;re opening in stages. {RELEASE_EXPECTATION_COPY} Join the
              waitlist for access. Premium is &pound;49/month — Free users can
              activate a 7-day trial from inside the app. Enterprise and hosted
              solutions are a conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PUBLIC_TIERS.map((tier, i) => {
              const isFeatured = i === 1;
              return (
                <Card
                  key={tier.id}
                  className={`relative flex flex-col transition-all duration-300 ${
                    isFeatured
                      ? "border-accent/40 shadow-lg shadow-accent-glow scale-[1.02]"
                      : "border-border hover:border-accent/20"
                  }`}
                >
                  {isFeatured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-accent-strong text-white text-xs font-semibold rounded-full shadow-lg shadow-accent-strong/30">
                      Most popular
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-text text-xl tracking-tight">
                      {tier.name}
                    </CardTitle>
                    <CardDescription className="text-muted text-xs font-medium uppercase tracking-wider">
                      {tier.targetUser}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    <div className="mb-5">
                      <div className="text-3xl font-bold text-text tracking-tight">
                        {tier.price}
                        {tier.period ? (
                          <span className="text-sm text-muted font-normal ml-1">
                            {tier.period}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-muted mb-5 leading-relaxed">
                      {tier.description}
                    </p>
                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-text/90">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <TierCta
                      label={tier.ctaLabel}
                      href={tier.ctaHref}
                      external={tier.ctaExternal}
                      featured={isFeatured}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="max-w-2xl mx-auto mt-14 card-glow rounded-xl p-8 text-center">
            <h2 className="text-lg font-semibold text-text mb-3 tracking-tight">
              Hosted deployments
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-5">
              Need Axel in a dedicated, managed environment? We offer hosted
              solutions scoped to your organisation — pricing depends on
              requirements. Tell us what you need.
            </p>
            <a
              href="mailto:admin@evans-software-solutions.com?subject=Hosted%20Axel"
              className="inline-flex text-accent font-medium hover:underline underline-offset-4 text-sm transition-all duration-200"
            >
              admin@evans-software-solutions.com
            </a>
          </div>

          <div className="max-w-2xl mx-auto mt-12 text-center text-sm text-muted/70">
            <p>Cancel any time. No questions asked.</p>
          </div>

          <div className="max-w-2xl mx-auto mt-20">
            <h2 className="text-2xl font-bold text-text mb-8 text-center tracking-tight">
              Common questions
            </h2>
            <div className="space-y-8">
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
                  className="pb-8 border-b border-border-subtle last:border-0 last:pb-0"
                >
                  <h3 className="text-text font-semibold mb-3 tracking-tight">
                    {q}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">{a}</p>
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
