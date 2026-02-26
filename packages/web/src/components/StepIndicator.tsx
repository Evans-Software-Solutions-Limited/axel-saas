import React from "react";

interface StepIndicatorProps {
  totalSteps: number;
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  totalSteps,
  currentStep,
}) => {
  return (
    <div className="flex gap-3 justify-center">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const isCompleted = index < currentStep;
        const isCurrent = index === currentStep;

        return (
          <div
            key={index}
            className={`w-3 h-3 rounded-full transition-colors duration-150 ${
              isCompleted
                ? "bg-blue-500"
                : isCurrent
                  ? "border-2 border-blue-500 bg-transparent"
                  : "bg-gray-600"
            }`}
          />
        );
      })}
    </div>
  );
};

export default StepIndicator;
