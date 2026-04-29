import { useEffect } from "react";
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
import { provisionFreeSilently } from "./subscribeApi";
import { useCheckoutSelection } from "@/hooks/useCheckoutSelection";

export function Subscribe() {
  const { loadingTier, error, handleSelectPlan } = useCheckoutSelection();
  // No onboarding signals available on the generic pricing page — recommendation
  // is only shown when real user signals (from discovery/onboarding chat) exist.
  const recommendation = getRecommendedPlan();

  // Catches the email-confirmation flow: SignUp can't reach /free until the
  // session is established, so the user's first authed page hit (here, on
  // ProtectedRoute) is the safety net. Idempotent on the backend — a no-op
  // for users who already have a row.
  useEffect(() => {
    void provisionFreeSilently();
  }, []);

  return (
    <div className="min-h-screen bg-surface p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-text">
            Choose your <span className="text-accent">Axel</span> plan
          </h1>
          <p className="text-muted text-lg">
            Pick the plan that fits how you work
          </p>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isRecommended =
            recommendation !== null && plan.tierId === recommendation.tierId;

          return (
            <Card
              key={plan.name}
              className={`border-2 relative flex flex-col transition-all overflow-visible ${
                isRecommended
                  ? "border-accent bg-surface-elevated"
                  : "border-border"
              }`}
            >
              {/* Recommendation badge — always explains why */}
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <Badge className="bg-accent text-white">
                    {recommendation.shortReason}
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-text text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-muted text-xs font-medium uppercase tracking-wide">
                  {plan.tagline}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-col flex-1">
                {/* Price */}
                <div className="mb-4">
                  <div className="text-3xl font-bold text-text">
                    {plan.price}
                    <span className="text-sm text-muted font-normal">
                      {plan.period}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-muted mb-4 leading-relaxed">
                  {plan.description}
                </p>

                {/* Recommendation reason */}
                {isRecommended && (
                  <p className="text-xs text-accent/80 italic mb-4">
                    {recommendation.reason}
                  </p>
                )}

                {/* Features List */}
                <ul className="space-y-3 mb-6 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-text">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSelectPlan(plan.tierId)}
                  disabled={loadingTier !== null}
                  className={`w-full ${
                    isRecommended
                      ? "bg-accent hover:bg-accent/90 text-white"
                      : "bg-surface-raised hover:bg-surface-elevated text-text border border-border"
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
              Yes, you can upgrade or downgrade at any time. Changes take effect
              at the next billing cycle.
            </p>
          </div>
          <div>
            <h3 className="text-text font-semibold mb-2">
              Is there a free trial?
            </h3>
            <p className="text-muted text-sm">
              Free users can activate a 7-day Premium trial from inside the app
              — no card required until the trial ends. Free itself has no time
              limit; use it for as long as you like.
            </p>
          </div>
          <div>
            <h3 className="text-text font-semibold mb-2">
              What payment methods do you accept?
            </h3>
            <p className="text-muted text-sm">
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
