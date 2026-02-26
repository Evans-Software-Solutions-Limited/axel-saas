import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/eden";
import SubscriptionCard from "@/components/SubscriptionCard";

interface Plan {
  id: string;
  name: string;
  priceGbpMonthly: number;
  features: string[];
}

export function Subscribe() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Fetch plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.core.subscriptions.tiers.get();
        if (response.data) {
          setPlans(response.data as Plan[]);
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
        setError("Failed to load subscription plans");
      }
    };
    fetchPlans();
  }, []);

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.core.subscriptions.checkout.post({
        tierId: planId,
      });

      if (response.data?.success) {
        // For now, redirect to onboarding since Stripe integration is coming soon
        navigate("/onboarding");
      } else {
        setError("Failed to process subscription");
      }
    } catch (err) {
      console.error("Subscription error:", err);
      setError("Failed to process subscription");
    }

    setIsLoading(false);
    setSelectedPlan(null);
  };

  const planDetails: Record<
    string,
    { description: string; recommended?: boolean }
  > = {
    starter: {
      description: "Daily brief, Telegram, basic tasks, email triage",
    },
    pro: {
      description:
        "Everything + calendar, email send, integrations, sub-agents",
      recommended: true,
    },
    business: {
      description: "Custom channels, multiple agents, priority support",
    },
    developer: {
      description:
        "Full exec access, code gen, heavy sub-agent use, API access",
    },
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] dark text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-gray-400">
            Select the perfect subscription tier for your needs
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const details = planDetails[plan.id];
            const isRecommended = details?.recommended;

            return (
              <SubscriptionCard
                key={plan.id}
                tier={plan.name}
                priceMonthly={plan.priceGbpMonthly}
                features={plan.features}
                isRecommended={isRecommended}
                onSelect={() => handleSelectPlan(plan.id)}
                isLoading={isLoading && selectedPlan === plan.id}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Subscribe;
