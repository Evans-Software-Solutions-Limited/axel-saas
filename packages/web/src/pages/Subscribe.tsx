import { Button } from "@axel-saas/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axel-saas/ui/card";
import { Badge } from "@axel-saas/ui/badge";
import { IconCheck } from "@tabler/icons-react";
import { PLANS, getRecommendedPlan } from "./planRecommendation";
import { useCheckoutSelection } from "@/hooks/useCheckoutSelection";

export function Subscribe() {
  const { loadingTier, error, handleSelectPlan } = useCheckoutSelection();
  // No onboarding signals available on the generic pricing page — recommendation
  // is only shown when real user signals (from discovery/onboarding chat) exist.
  const recommendation = getRecommendedPlan();

  return (
    <div className="min-h-screen bg-surface p-6 py-16">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-14">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold text-text tracking-tight">
            Choose your <span className="text-accent">Axel</span> plan
          </h1>
          <p className="text-muted text-lg">
            Pick the plan that fits how you work
          </p>
          {error && (
            <p className="text-destructive text-sm mt-2 bg-destructive/10 inline-block px-4 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
        {PLANS.map((plan) => {
          const isRecommended =
            recommendation !== null && plan.tierId === recommendation.tierId;

          return (
            <Card
              key={plan.name}
              className={`relative flex flex-col transition-all overflow-visible ${
                isRecommended
                  ? "border-accent/60 bg-surface-elevated/60 shadow-lg shadow-accent/5"
                  : "border-border/60 hover:border-border"
              }`}
            >
              {/* Recommendation badge */}
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <Badge className="bg-accent text-white shadow-sm shadow-accent/30 text-xs">
                    {recommendation.shortReason}
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-text text-xl tracking-tight">
                  {plan.name}
                </CardTitle>
                <CardDescription className="text-muted/70 text-xs font-medium uppercase tracking-widest">
                  {plan.tagline}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col flex-1">
                {/* Price */}
                <div className="mb-5">
                  <div className="text-3xl font-bold text-text">
                    {plan.price}
                    <span className="text-sm text-muted font-normal ml-0.5">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted/80 mb-5 leading-relaxed">
                  {plan.description}
                </p>

                {/* Recommendation reason */}
                {isRecommended && (
                  <p className="text-xs text-accent/70 italic mb-5">
                    {recommendation.reason}
                  </p>
                )}

                {/* Features List */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-text/90">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.tierId)}
                  disabled={loadingTier !== null}
                  className={`w-full h-10 text-sm font-medium ${
                    isRecommended
                      ? "bg-accent hover:bg-accent/85 text-white shadow-sm shadow-accent/20"
                      : "bg-surface-raised hover:bg-surface-elevated text-text border border-border/60"
                  }`}
                >
                  {plan.tierId === null
                    ? "Contact sales"
                    : loadingTier === plan.tierId
                      ? "Redirecting..."
                      : "Get started"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ Section */}
      <div className="max-w-2xl mx-auto mt-20">
        <h2 className="text-2xl font-bold text-text mb-8 text-center tracking-tight">
          Common questions
        </h2>
        <div className="space-y-8">
          <div className="border-b border-border/30 pb-6">
            <h3 className="text-text font-semibold mb-2">
              Can I change my plan later?
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              Yes, you can upgrade or downgrade at any time. Changes take effect
              at the next billing cycle.
            </p>
          </div>
          <div className="border-b border-border/30 pb-6">
            <h3 className="text-text font-semibold mb-2">
              Is there a free trial?
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              Yes, all plans include a 14-day free trial with full access.
            </p>
          </div>
          <div>
            <h3 className="text-text font-semibold mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-muted text-sm leading-relaxed">
              We accept all major credit cards, bank transfers, and enterprise
              invoicing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Subscribe;
