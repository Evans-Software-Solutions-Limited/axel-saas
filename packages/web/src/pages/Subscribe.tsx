import { IconCheck } from "@tabler/icons-react";

interface Plan {
  name: string;
  price: number;
  description: string;
  features: string[];
  highlighted: boolean;
}

export function Subscribe() {
  const plans: Plan[] = [
    {
      name: "Starter",
      price: 9,
      description: "Perfect for getting started",
      features: [
        "1 AI agent",
        "Basic chat interface",
        "Email integration",
        "Community support",
      ],
      highlighted: false,
    },
    {
      name: "Pro",
      price: 29,
      description: "Most popular choice",
      features: [
        "5 AI agents",
        "Advanced chat features",
        "Email, Calendar, Slack",
        "Priority support",
        "Custom workflows",
      ],
      highlighted: true,
    },
    {
      name: "Business",
      price: 79,
      description: "For growing teams",
      features: [
        "Unlimited agents",
        "Advanced analytics",
        "All integrations",
        "Dedicated support",
        "Team management",
        "Custom branding",
      ],
      highlighted: false,
    },
    {
      name: "Developer",
      price: 149,
      description: "Enterprise power",
      features: [
        "Everything in Business",
        "API access",
        "Webhook support",
        "Custom integrations",
        "SLA guarantee",
        "On-premise option",
      ],
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen bg-[#12141f] p-8">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-lg text-[#8b8fa8]">
          Choose the plan that fits your needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative flex flex-col bg-[#1e2130] border rounded-2xl p-6 transition-all duration-150 ${
              plan.highlighted
                ? "ring-2 ring-indigo-500 md:scale-105 md:-mt-6 md:mb-6"
                : "border-[#2a2d3e]"
            }`}
          >
            {/* Badge */}
            {plan.highlighted && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <span className="bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Most Popular
                </span>
              </div>
            )}

            {/* Plan info */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
              <p className="text-xs text-[#8b8fa8]">{plan.description}</p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">
                  £{plan.price}
                </span>
                <span className="text-[#8b8fa8] text-sm">/month</span>
              </div>
            </div>

            {/* Features */}
            <div className="flex-1 mb-6">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <IconCheck
                      size={18}
                      className="text-indigo-400 flex-shrink-0 mt-0.5"
                    />
                    <span className="text-sm text-[#e8e9f0]">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA Button */}
            <button
              className={`w-full py-3 rounded-lg font-medium transition-colors duration-150 ${
                plan.highlighted
                  ? "bg-indigo-500 text-white hover:bg-indigo-600"
                  : "border border-[#2a2d3e] text-white hover:bg-[#252840]"
              }`}
            >
              Get Started
            </button>
          </div>
        ))}
      </div>

      {/* FAQ or Additional info */}
      <div className="mt-16 text-center text-[#8b8fa8]">
        <p>
          All plans include a 14-day free trial. No credit card required.{" "}
          <a href="#" className="text-indigo-400 hover:text-indigo-300">
            See all features
          </a>
        </p>
      </div>
    </div>
  );
}

export default Subscribe;
