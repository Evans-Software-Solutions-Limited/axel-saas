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
import { Badge } from "@/components/ui/badge";
import { IconCheck } from "@tabler/icons-react";
import { PLANS, getRecommendedPlan } from "./planRecommendation";

const recommendation = getRecommendedPlan();

export function Pricing() {
  return (
    <MarketingLayout>
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-text mb-4">
              Simple, transparent pricing
            </h1>
            <p className="text-muted text-lg">
              14-day free trial on all plans. No credit card required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            {PLANS.map((plan) => {
              const isRecommended = plan.tierId === recommendation.tierId;
              return (
                <Card
                  key={plan.name}
                  className={`border-2 relative flex flex-col transition-all ${
                    isRecommended
                      ? "border-accent bg-surface-elevated"
                      : "border-border"
                  }`}
                >
                  {isRecommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge className="bg-accent text-white">
                        {recommendation.shortReason}
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-text text-xl">
                      {plan.name}
                    </CardTitle>
                    <CardDescription className="text-muted text-xs font-medium uppercase tracking-wide">
                      {plan.tagline}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1">
                    <div className="mb-4">
                      <div className="text-3xl font-bold text-text">
                        {plan.price}
                        <span className="text-sm text-muted font-normal">
                          {plan.period}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted mb-4 leading-relaxed">
                      {plan.description}
                    </p>
                    <ul className="space-y-3 mb-6 flex-1">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-text">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to="/signup">
                      <Button
                        className={`w-full ${
                          isRecommended
                            ? "bg-accent hover:bg-accent/90 text-white"
                            : "bg-surface-raised hover:bg-surface-elevated text-text border border-border"
                        }`}
                      >
                        {plan.tierId === null ? "Contact sales" : "Get started"}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* FAQ */}
          <div className="max-w-2xl mx-auto mt-16">
            <h2 className="text-2xl font-bold text-text mb-6 text-center">
              Common questions
            </h2>
            <div className="space-y-6">
              <div>
                <h3 className="text-text font-semibold mb-2">
                  Can I change my plan later?
                </h3>
                <p className="text-muted text-sm">
                  Yes, upgrade or downgrade any time. Changes take effect at the
                  next billing cycle.
                </p>
              </div>
              <div>
                <h3 className="text-text font-semibold mb-2">
                  Is there a free trial?
                </h3>
                <p className="text-muted text-sm">
                  Yes, all plans include a 14-day free trial with full access.
                </p>
              </div>
              <div>
                <h3 className="text-text font-semibold mb-2">
                  What payment methods do you accept?
                </h3>
                <p className="text-muted text-sm">
                  All major credit cards, bank transfers, and enterprise
                  invoicing.
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
