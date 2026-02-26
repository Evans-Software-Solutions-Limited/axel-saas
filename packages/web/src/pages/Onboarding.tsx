import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/eden";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AxelLogo from "@/components/AxelLogo";
import StepIndicator from "@/components/StepIndicator";
import { IconLogout } from "@tabler/icons-react";

interface OnboardingData {
  name: string;
  role?: string;
  helpWith: string[];
  typicalDay?: string;
  channels: string[];
  morningBrief: boolean;
  briefTime?: string;
}

const STEP_LABELS = [
  "Your name",
  "Your work",
  "What you need help with",
  "Your typical day",
  "Preferred channels",
  "Morning brief",
  "Confirm",
];

const HELP_WITH_OPTIONS = [
  "Email triage",
  "Calendar management",
  "Research",
  "Writing",
  "Code help",
  "Task management",
  "Daily briefs",
];

const ROLE_OPTIONS = ["Founder", "Engineer", "Creative", "Other"];
const CHANNEL_OPTIONS = ["Telegram", "WhatsApp", "Email"];

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    role: "",
    helpWith: [],
    typicalDay: "",
    channels: [],
    morningBrief: false,
    briefTime: "08:00",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleNext = () => {
    if (currentStep < STEP_LABELS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await api.core.users.onboarding.post(data);

      if (response.data?.success) {
        navigate("/dashboard");
      } else {
        setError("Failed to complete onboarding");
      }
    } catch (err) {
      console.error("Onboarding error:", err);
      setError("Failed to complete onboarding. Please try again.");
    }

    setIsSubmitting(false);
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const toggleHelpWith = (option: string) => {
    updateData({
      helpWith: data.helpWith.includes(option)
        ? data.helpWith.filter((item) => item !== option)
        : [...data.helpWith, option],
    });
  };

  const toggleChannel = (channel: string) => {
    updateData({
      channels: data.channels.includes(channel)
        ? data.channels.filter((item) => item !== channel)
        : [...data.channels, channel],
    });
  };

  const canProceedToNext =
    currentStep === 0
      ? data.name.trim().length > 0
      : currentStep === 1
        ? true
        : currentStep === 2
          ? data.helpWith.length > 0
          : currentStep === 3
            ? true
            : currentStep === 4
              ? data.channels.length > 0
              : currentStep === 5
                ? true
                : currentStep === 6
                  ? true
                  : false;

  return (
    <div className="min-h-screen bg-[#0a0a0a] dark text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#111] px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <AxelLogo size="md" variant="text" />
          <Button
            onClick={handleSignOut}
            variant="ghost"
            className="text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
          >
            <IconLogout size={20} />
            <span>Sign out</span>
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Progress indicator */}
          <div className="mb-8">
            <StepIndicator
              totalSteps={STEP_LABELS.length}
              currentStep={currentStep}
            />
            <div className="text-center mt-4">
              <h1 className="text-2xl font-bold text-white mb-1">
                Setup your assistant
              </h1>
              <p className="text-sm text-gray-400">
                Step {currentStep + 1} of {STEP_LABELS.length}
              </p>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-red-400 border border-red-500/20">
              {error}
            </div>
          )}

          {/* Content Card */}
          <Card className="bg-[#111] border-[#1a1a1a] p-8 space-y-6">
            {currentStep === 0 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">
                  What's your name?
                </h2>
                <p className="text-gray-400">What should I call you?</p>
                <Input
                  type="text"
                  value={data.name}
                  onChange={(e) => updateData({ name: e.target.value })}
                  placeholder="Your name"
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                  autoFocus
                />
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">
                  What do you do for work?
                </h2>
                <p className="text-gray-400">Brief description of your role</p>
                <Input
                  type="text"
                  value={data.role || ""}
                  onChange={(e) => updateData({ role: e.target.value })}
                  placeholder="e.g., Founder at startup, Software engineer, etc."
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                  autoFocus
                />
                <div>
                  <p className="text-sm text-gray-400 mb-3">
                    Or select a role:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {ROLE_OPTIONS.map((role) => (
                      <button
                        key={role}
                        onClick={() => updateData({ role })}
                        className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                          data.role === role
                            ? "bg-blue-600 text-white"
                            : "bg-[#1a1a1a] text-gray-300 border border-[#2a2a2a] hover:border-blue-500"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">
                  What do you mainly want help with?
                </h2>
                <p className="text-gray-400">Select all that apply</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {HELP_WITH_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => toggleHelpWith(option)}
                      className={`rounded-lg px-4 py-3 text-left font-medium transition-colors ${
                        data.helpWith.includes(option)
                          ? "bg-blue-600 text-white"
                          : "bg-[#1a1a1a] text-gray-300 border border-[#2a2a2a] hover:border-blue-500"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">
                  What does a typical day look like?
                </h2>
                <p className="text-gray-400">
                  Optional — helps me understand your context
                </p>
                <Textarea
                  value={data.typicalDay || ""}
                  onChange={(e) => updateData({ typicalDay: e.target.value })}
                  placeholder="Describe your typical day (e.g., client calls, emails, coding, meetings)"
                  className="bg-[#1a1a1a] border-[#2a2a2a] text-white resize-none"
                  autoFocus
                />
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">
                  Which channels would you like to use?
                </h2>
                <p className="text-gray-400">Select all that apply</p>
                <div className="space-y-3">
                  {CHANNEL_OPTIONS.map((channel) => (
                    <button
                      key={channel}
                      onClick={() => toggleChannel(channel)}
                      className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors border ${
                        data.channels.includes(channel)
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-[#1a1a1a] text-gray-300 border-[#2a2a2a] hover:border-blue-500"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{channel}</span>
                        {channel === "Telegram" && (
                          <Badge
                            variant="default"
                            className="text-xs bg-green-600"
                          >
                            Recommended
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-white">
                  Would you like a morning brief?
                </h2>
                <p className="text-gray-400">
                  A daily summary delivered to your chosen channel
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => updateData({ morningBrief: true })}
                    className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors border ${
                      data.morningBrief
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-[#1a1a1a] text-gray-300 border-[#2a2a2a] hover:border-blue-500"
                    }`}
                  >
                    Yes, I'd like a morning brief
                  </button>
                  <button
                    onClick={() => updateData({ morningBrief: false })}
                    className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors border ${
                      !data.morningBrief
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-[#1a1a1a] text-gray-300 border-[#2a2a2a] hover:border-blue-500"
                    }`}
                  >
                    No, I don't need a brief
                  </button>
                </div>

                {data.morningBrief && (
                  <div className="pt-4 border-t border-[#2a2a2a]">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Preferred time
                    </label>
                    <Input
                      type="time"
                      value={data.briefTime || "08:00"}
                      onChange={(e) =>
                        updateData({ briefTime: e.target.value })
                      }
                      className="bg-[#1a1a1a] border-[#2a2a2a] text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-4xl font-bold text-white mb-2">
                    Your assistant is ready ⚡
                  </h1>
                  <p className="text-gray-400">Confirm your setup and launch</p>
                </div>

                <div className="bg-[#1a1a1a] rounded-lg p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Name:</span>
                    <span className="text-white font-medium">{data.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Role:</span>
                    <span className="text-white font-medium">
                      {data.role || "Not specified"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Help with:</span>
                    <span className="text-white font-medium">
                      {data.helpWith.join(", ") || "Not selected"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Channels:</span>
                    <span className="text-white font-medium">
                      {data.channels.join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Morning brief:</span>
                    <span className="text-white font-medium">
                      {data.morningBrief ? `Yes at ${data.briefTime}` : "No"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-4 pt-4 border-t border-[#2a2a2a]">
              <Button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                variant="outline"
                className="flex-1"
              >
                Previous
              </Button>

              {currentStep < STEP_LABELS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canProceedToNext}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {isSubmitting ? "Completing..." : "Launch"}
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
