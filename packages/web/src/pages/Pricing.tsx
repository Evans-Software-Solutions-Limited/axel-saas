import { Link } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-text mb-4">Pricing</h1>
            <p className="text-muted text-lg max-w-2xl mx-auto">
              We&apos;re opening in stages. {RELEASE_EXPECTATION_COPY} Join the
              waitlist for access; Premium pricing will be published here.
              Enterprise and hosted solutions are a conversation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PUBLIC_TIERS.map((tier) => (
              <Card
                key={tier.id}
                className={`border-2 relative flex flex-col transition-all border-border`}
              >
                <CardHeader>
                  <CardTitle className="text-text text-xl">
                    {tier.name}
                  </CardTitle>
                  <CardDescription className="text-muted text-xs font-medium uppercase tracking-wide">
                    {tier.targetUser}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1">
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-text">
                      {tier.price}
                      {tier.period ? (
                        <span className="text-sm text-muted font-normal">
                          {tier.period}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs text-muted mb-4 leading-relaxed">
                    {tier.description}
                  </p>
                  <ul className="space-y-3 mb-6 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-text">{feature}</span>
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

          <div className="max-w-2xl mx-auto mt-12 rounded-xl border border-border bg-surface-raised p-6 text-center">
            <h2 className="text-lg font-semibold text-text mb-2">
              Hosted deployments
            </h2>
            <p className="text-sm text-muted leading-relaxed mb-4">
              Need Axel in a dedicated, managed environment? We offer hosted
              solutions scoped to your organisation — pricing depends on
              requirements. Tell us what you need.
            </p>
            <a
              href="mailto:admin@evans-software-soltuions.com?subject=Hosted%20Axel"
              className="inline-flex text-accent font-medium hover:underline text-sm"
            >
              admin@evans-software-soltuions.com
            </a>
          </div>

          <div className="max-w-2xl mx-auto mt-12 text-center text-sm text-muted">
            <p>Cancel any time. No questions asked.</p>
          </div>

          <div className="max-w-2xl mx-auto mt-16">
            <h2 className="text-2xl font-bold text-text mb-6 text-center">
              Common questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-text font-semibold mb-2">
                  What are the Free tier limits?
                </h3>
                <p className="text-muted text-sm">
                  Free is for meeting Axel and light personal use. We cap volume
                  and sub-agents so expectations stay honest — upgrade when you
                  outgrow them.
                </p>
              </div>
              <div>
                <h3 className="text-text font-semibold mb-2">
                  How do I get access?
                </h3>
                <p className="text-muted text-sm">
                  Join the waitlist. {RELEASE_EXPECTATION_COPY} We&apos;ll
                  invite people in batches as we scale capacity.
                </p>
              </div>
              <div>
                <h3 className="text-text font-semibold mb-2">
                  How does the Premium trial work?
                </h3>
                <p className="text-muted text-sm">
                  After you&apos;re up and running, you may see a time-limited
                  Premium trial in-app — not a wall at signup. Example: try
                  Premium free for 7 days; no card until day 8. Final terms TBD.
                </p>
              </div>
              <div>
                <h3 className="text-text font-semibold mb-2">
                  What does Enterprise include?
                </h3>
                <p className="text-muted text-sm">
                  SSO, audit logs, SLA options, custom retention, integrations,
                  and dedicated support — tell us what you need at{" "}
                  <a
                    href="mailto:admin@evans-software-soltuions.com"
                    className="text-accent hover:underline"
                  >
                    admin@evans-software-soltuions.com
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
