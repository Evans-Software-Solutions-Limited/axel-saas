import React from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { IconCheck } from "@tabler/icons-react";

interface SubscriptionCardProps {
  tier: string;
  priceMonthly: number;
  features: string[];
  isRecommended?: boolean;
  onSelect: () => void;
  isLoading: boolean;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  tier,
  priceMonthly,
  features,
  isRecommended = false,
  onSelect,
  isLoading,
}) => {
  return (
    <Card
      className={`relative flex flex-col gap-6 p-6 transition-all duration-150 ${
        isRecommended
          ? "ring-2 ring-blue-500 bg-blue-500/5 border-blue-500"
          : "border border-[#1a1a1a] bg-[#111] hover:border-blue-400"
      }`}
    >
      {isRecommended && (
        <Badge variant="default" className="absolute -top-3 left-6">
          Most Popular
        </Badge>
      )}

      <div>
        <h3 className="text-2xl font-bold text-white">{tier}</h3>
        <p className="text-sm text-gray-400 mt-1">Perfect for your needs</p>
      </div>

      <div>
        <span className="text-4xl font-bold text-white">£{priceMonthly}</span>
        <span className="text-gray-400">/month</span>
      </div>

      <Button
        onClick={onSelect}
        disabled={isLoading}
        className={
          isRecommended
            ? "w-full bg-blue-600 hover:bg-blue-700 text-white"
            : "w-full border border-[#2a2a2a] text-white hover:bg-[#1a1a1a]"
        }
        variant={isRecommended ? "default" : "outline"}
      >
        {isLoading ? "Selecting..." : "Select plan"}
      </Button>

      <div className="border-t border-[#2a2a2a]" />

      <ul className="space-y-3">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-3 text-gray-400">
            <IconCheck
              size={20}
              className="text-blue-500 flex-shrink-0 mt-0.5"
            />
            <span className="text-sm">{feature}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default SubscriptionCard;
