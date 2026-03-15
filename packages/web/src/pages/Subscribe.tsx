import { useNavigate } from "react-router";
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

const plans = [
  {
    name: "Starter",
    price: "£29",
    period: "/month",
    description: "Basic tasks and automation",
    features: [
      "Basic task automation",
      "Email management",
      "Calendar integration",
      "Up to 100 tasks/month",
    ],
    highlight: false,
  },
  {
    name: "Professional",
    price: "£79",
    period: "/month",
    description: "Everything for growing teams",
    features: [
      "Everything in Starter",
      "Document management",
      "Advanced integrations",
      "Up to 1,000 tasks/month",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "Business",
    price: "£149",
    period: "/month",
    description: "Enterprise features",
    features: [
      "Everything in Professional",
      "Team agents",
      "Compliance knowledge base",
      "Up to 10,000 tasks/month",
      "Dedicated support",
    ],
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "/month",
    description: "Full deployment and integration",
    features: [
      "Everything in Business",
      "Full deployment",
      "Custom integrations",
      "MCP knowledge integrations",
      "SLA guarantee",
      "Custom contracts",
    ],
    highlight: false,
  },
];

export function Subscribe() {
  const navigate = useNavigate();

  const handleSelectPlan = (planName: string) => {
    // In a real app, this would process the payment
    if (planName === "Enterprise") {
      // Handle Enterprise inquiry
      console.log("Enterprise plan inquiry");
    } else {
      // Proceed to root redirect after selecting plan (routes to chat or dashboard based on onboarding state)
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-surface p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-12">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-text">
            Choose your <span className="text-accent">Axel</span> plan
          </h1>
          <p className="text-muted text-lg">
            Pick the perfect plan for your team's needs
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`border-2 relative flex flex-col transition-all ${
              plan.highlight
                ? "border-accent bg-surface-elevated"
                : "border-border"
            }`}
          >
            {/* Recommended Badge */}
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-accent text-white">Recommended</Badge>
              </div>
            )}

            <CardHeader>
              <CardTitle className="text-text text-xl">{plan.name}</CardTitle>
              <CardDescription className="text-muted">
                {plan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col flex-1">
              {/* Price */}
              <div className="mb-6">
                <div className="text-3xl font-bold text-text">
                  {plan.price}
                  <span className="text-sm text-muted font-normal">
                    {plan.period}
                  </span>
                </div>
              </div>

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
                onClick={() => handleSelectPlan(plan.name)}
                className={`w-full ${
                  plan.highlight
                    ? "bg-accent hover:bg-accent/90 text-white"
                    : "bg-surface-raised hover:bg-surface-elevated text-text border border-border"
                }`}
              >
                {plan.name === "Enterprise" ? "Contact sales" : "Get started"}
              </Button>
            </CardContent>
          </Card>
        ))}
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
              Yes, all plans include a 14-day free trial with full access.
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
