import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/eden";

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
    <div className="min-h-screen bg-[#0f0f0f] dark text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-12">
          <h1 className="mb-4 text-4xl font-bold">Choose your plan</h1>
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
              <div
                key={plan.id}
                className={`relative rounded-lg border ${
                  isRecommended
                    ? "border-blue-500 bg-blue-500/5"
                    : "border-[#1a1a1a] bg-[#111]"
                } p-6 transition-all hover:border-blue-400`}
              >
                {isRecommended && (
                  <div className="absolute -top-3 left-6 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                    Recommended
                  </div>
                )}

                <h2 className="text-2xl font-bold mb-2">{plan.name}</h2>
                <div className="mb-4">
                  <span className="text-3xl font-bold">
                    £{plan.priceGbpMonthly}
                  </span>
                  <span className="text-gray-400 ml-2">/month</span>
                </div>

                <p className="text-sm text-gray-400 mb-6">
                  {details?.description || ""}
                </p>

                <button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isLoading && selectedPlan === plan.id}
                  className="w-full rounded-lg bg-blue-500 py-2 font-medium text-white hover:bg-blue-600 disabled:opacity-50 transition-colors mb-6"
                >
                  {isLoading && selectedPlan === plan.id
                    ? "Selecting..."
                    : "Select plan"}
                </button>

                <div className="space-y-3 border-t border-[#2a2a2a] pt-6">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Subscribe;
