import { Button } from "@axel-saas/ui/button";
import { Badge } from "@axel-saas/ui/badge";
import { IconCheck } from "@tabler/icons-react";
import { PLANS, type Recommendation } from "../planRecommendation";

interface DiscoveryPanelProps {
  recommendation: Recommendation | null;
  onSelectPlan: (tierId: string | null) => void;
  loadingTier: string | null;
  error: string | null;
}

export function DiscoveryPanel({
  recommendation,
  onSelectPlan,
  loadingTier,
  error,
}: DiscoveryPanelProps) {
  const isDisabled = loadingTier !== null;

  return (
    <div className="space-y-4">
      {/* Axel intro bubble */}
      <div className="flex justify-start">
        <div className="bg-surface-raised text-text rounded-lg rounded-bl-none px-4 py-3 max-w-sm">
          <p className="text-sm">
            To get started, pick a plan that fits how you work.
            {recommendation !== null && (
              <> I&apos;ve suggested one below — but you can choose any.</>
            )}
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PLANS.map((plan) => {
          const isRecommended =
            recommendation !== null && plan.tierId === recommendation.tierId;
          const isLoading = plan.tierId !== null && loadingTier === plan.tierId;

          return (
            <div
              key={plan.name}
              className={`relative border-2 rounded-lg p-4 flex flex-col gap-3 ${
                isRecommended
                  ? "border-accent bg-surface-elevated"
                  : "border-border bg-surface-raised"
              }`}
            >
              {/* Header row */}
              <div>
                <div className="flex items-baseline justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-text">{plan.name}</span>
                  <span className="text-xs text-muted">{plan.tagline}</span>
                </div>
                <div className="text-xl font-bold text-text mt-0.5">
                  {plan.price}
                  <span className="text-xs font-normal text-muted ml-0.5">
                    {plan.period}
                  </span>
                </div>
              </div>

              {/* Recommendation badge + reason */}
              {isRecommended && (
                <div className="space-y-1">
                  <Badge className="bg-accent text-white text-xs">
                    {recommendation.shortReason}
                  </Badge>
                  <p className="text-xs text-accent/80 italic">
                    {recommendation.reason}
                  </p>
                </div>
              )}

              <p className="text-xs text-muted leading-relaxed">
                {plan.description}
              </p>

              {/* Feature list — first 3 + overflow count */}
              <ul className="space-y-1 flex-1">
                {plan.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <IconCheck className="w-3 h-3 text-success mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-text">{feature}</span>
                  </li>
                ))}
                {plan.features.length > 3 && (
                  <li className="text-xs text-muted pl-4.5">
                    +{plan.features.length - 3} more
                  </li>
                )}
              </ul>

              <Button
                onClick={() => onSelectPlan(plan.tierId)}
                disabled={isDisabled}
                size="sm"
                className={`w-full mt-auto ${
                  isRecommended
                    ? "bg-accent hover:bg-accent/90 text-white"
                    : "bg-surface hover:bg-surface-elevated text-text border border-border"
                }`}
              >
                {plan.tierId === null
                  ? "Contact sales"
                  : isLoading
                    ? "Redirecting..."
                    : "Get started"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
