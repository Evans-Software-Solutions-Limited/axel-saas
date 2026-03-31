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

const tierCtaClassName =
  "w-full bg-surface-raised hover:bg-surface-elevated text-text border border-border";

function TierCta({
  label,
  href,
  external,
}: Readonly<{
  label: string;
  href: string;
  external?: boolean;
}>) {
  if (external) {
    return (
      <a href={href} className="block">
        <Button type="button" className={tierCtaClassName}>
          {label}
        </Button>
      </a>
    );
  }

  return (
    <Link to={href} className="block">
      <Button type="button" className={tierCtaClassName}>
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
              waitlist for access. Premium is £49/month — Free users can
              activate a 7-day trial from inside the app. Enterprise and hosted
              solutions are a conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PUBLIC_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className="border border-border/60 relative flex flex-col hover:border-border transition-colors"
              >
                <CardHeader>
                  <CardTitle className="text-text text-xl tracking-tight">
                    {tier.name}
                  </CardTitle>
                  <CardDescription className="text-muted/70 text-xs font-medium uppercase tracking-widest">
                    {tier.targetUser}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="mb-5">
                    <div className="text-3xl font-bold text-text">
                      {tier.price}
                      {tier.period ? (
                        <span className="text-sm text-muted font-normal ml-0.5">
                          {tier.period}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted/80 mb-5 leading-relaxed">
                    {tier.description}
                  </p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-text/90">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <TierCta
                    label={tier.ctaLabel}
                    href={tier.ctaHref}
                    external={tier.ctaExternal}
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-2xl mx-auto mt-14 rounded-xl border border-border/50 bg-surface-raised/50 p-8 text-center">
            <h2 className="text-lg font-semibold text-text mb-3 tracking-tight">
              Hosted deployments
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-4">
              Need Axel in a dedicated, managed environment? We offer hosted
              solutions scoped to your organisation — pricing depends on
              requirements. Tell us what you need.
            </p>
            <a
              href="mailto:admin@evans-software-solutions.com?subject=Hosted%20Axel"
              className="inline-flex text-accent font-medium hover:text-accent/80 transition-colors text-sm"
            >
              admin@evans-software-solutions.com &rarr;
            </a>
          </div>

          <div className="max-w-2xl mx-auto mt-10 text-center text-sm text-muted/70">
            <p>Cancel any time. No questions asked.</p>
          </div>

          <div className="max-w-2xl mx-auto mt-20">
            <h2 className="text-2xl font-bold text-text mb-8 text-center tracking-tight">
              Common questions
            </h2>
            <div className="space-y-8">
              <div className="border-b border-border/30 pb-6">
                <h3 className="text-text font-semibold mb-2">
                  What are the Free tier limits?
                </h3>
                <p className="text-muted text-sm leading-relaxed">
                  Free is for meeting Axel and light personal use. We cap volume
                  and sub-agents so expectations stay honest — upgrade when you
                  outgrow them.
                </p>
              </div>
              <div className="border-b border-border/30 pb-6">
                <h3 className="text-text font-semibold mb-2">
                  How do I get access?
                </h3>
                <p className="text-muted text-sm leading-relaxed">
                  Join the waitlist. {RELEASE_EXPECTATION_COPY} We&apos;ll
                  invite people in batches as we scale capacity.
                </p>
              </div>
              <div className="border-b border-border/30 pb-6">
                <h3 className="text-text font-semibold mb-2">
                  How does the Premium trial work?
                </h3>
                <p className="text-muted text-sm leading-relaxed">
                  Free users can activate a 7-day Premium trial from inside the
                  app — no card required until the trial ends. You&apos;re never
                  hit with a paywall at signup.
                </p>
              </div>
              <div>
                <h3 className="text-text font-semibold mb-2">
                  What does Enterprise include?
                </h3>
                <p className="text-muted text-sm leading-relaxed">
                  SSO, audit logs, SLA options, custom retention, integrations,
                  and dedicated support — tell us what you need at{" "}
                  <a
                    href="mailto:admin@evans-software-solutions.com"
                    className="text-accent hover:underline"
                  >
                    admin@evans-software-solutions.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default Pricing;
