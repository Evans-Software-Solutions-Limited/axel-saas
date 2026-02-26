import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/lib/eden";
import { IconLogout } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

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

  const progress = ((currentStep + 1) / STEP_LABELS.length) * 100;

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
                : false;

  return (
    <div className="min-h-screen bg-[#0f0f0f] dark text-white">
      {/* Header */}
      <div className="border-b border-[#1a1a1a] bg-[#111] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
              Axel
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <IconLogout size={20} />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto p-8">
        {/* Progress bar */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Setup your assistant</h1>
            <span className="text-sm text-gray-400">
              Step {currentStep + 1} of {STEP_LABELS.length}
            </span>
          </div>
          <div className="h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 rounded-lg bg-red-500/10 p-4 text-red-400 border border-red-500/20">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="rounded-lg border border-[#1a1a1a] bg-[#111] p-8">
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">What's your name?</h2>
              <p className="text-gray-400 mb-4">What should I call you?</p>
              <input
                type="text"
                value={data.name}
                onChange={(e) => updateData({ name: e.target.value })}
                placeholder="Your name"
                className="w-full rounded-lg bg-[#1a1a1a] px-4 py-3 text-white placeholder-gray-500 border border-[#2a2a2a] focus:border-blue-500 focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">
                What do you do for work?
              </h2>
              <p className="text-gray-400 mb-4">
                Brief description of your role
              </p>
              <input
                type="text"
                value={data.role || ""}
                onChange={(e) => updateData({ role: e.target.value })}
                placeholder="e.g., Founder at startup, Software engineer, etc."
                className="w-full rounded-lg bg-[#1a1a1a] px-4 py-3 text-white placeholder-gray-500 border border-[#2a2a2a] focus:border-blue-500 focus:outline-none mb-6"
                autoFocus
              />
              <div className="space-y-2">
                <p className="text-sm text-gray-400 mb-3">Or select a role:</p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      onClick={() => updateData({ role })}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                        data.role === role
                          ? "bg-blue-500 text-white"
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
            <div>
              <h2 className="text-2xl font-bold mb-6">
                What do you mainly want help with?
              </h2>
              <p className="text-gray-400 mb-6">Select all that apply</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {HELP_WITH_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleHelpWith(option)}
                    className={`rounded-lg px-4 py-3 text-left font-medium transition-colors ${
                      data.helpWith.includes(option)
                        ? "bg-blue-500 text-white"
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
            <div>
              <h2 className="text-2xl font-bold mb-6">
                What does a typical day look like?
              </h2>
              <p className="text-gray-400 mb-4">
                Optional — helps me understand your context
              </p>
              <textarea
                value={data.typicalDay || ""}
                onChange={(e) => updateData({ typicalDay: e.target.value })}
                placeholder="Describe your typical day (e.g., client calls, emails, coding, meetings)"
                className="w-full rounded-lg bg-[#1a1a1a] px-4 py-3 text-white placeholder-gray-500 border border-[#2a2a2a] focus:border-blue-500 focus:outline-none h-32 resize-none"
                autoFocus
              />
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">
                Which channels would you like to use?
              </h2>
              <p className="text-gray-400 mb-6">Select all that apply</p>
              <div className="space-y-3">
                {CHANNEL_OPTIONS.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => toggleChannel(channel)}
                    className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors border ${
                      data.channels.includes(channel)
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-[#1a1a1a] text-gray-300 border-[#2a2a2a] hover:border-blue-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{channel}</span>
                      {channel === "Telegram" && (
                        <span className="text-xs bg-green-500 px-2 py-1 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentStep === 5 && (
            <div>
              <h2 className="text-2xl font-bold mb-6">
                Would you like a morning brief?
              </h2>
              <p className="text-gray-400 mb-6">
                A daily summary delivered to your chosen channel
              </p>
              <div className="space-y-4">
                <button
                  onClick={() => updateData({ morningBrief: true })}
                  className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors border ${
                    data.morningBrief
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-[#1a1a1a] text-gray-300 border-[#2a2a2a] hover:border-blue-500"
                  }`}
                >
                  Yes, I'd like a morning brief
                </button>
                <button
                  onClick={() => updateData({ morningBrief: false })}
                  className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors border ${
                    !data.morningBrief
                      ? "bg-blue-500 text-white border-blue-500"
                      : "bg-[#1a1a1a] text-gray-300 border-[#2a2a2a] hover:border-blue-500"
                  }`}
                >
                  No, I don't need a brief
                </button>
              </div>

              {data.morningBrief && (
                <div className="mt-6 pt-6 border-t border-[#2a2a2a]">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Preferred time
                  </label>
                  <input
                    type="time"
                    value={data.briefTime || "08:00"}
                    onChange={(e) => updateData({ briefTime: e.target.value })}
                    className="w-full rounded-lg bg-[#1a1a1a] px-4 py-2 text-white border border-[#2a2a2a] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-8 flex gap-4">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="flex-1 rounded-lg px-4 py-3 font-medium text-white bg-[#1a1a1a] border border-[#2a2a2a] hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            {currentStep < STEP_LABELS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={!canProceedToNext}
                className="flex-1 rounded-lg px-4 py-3 font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 rounded-lg px-4 py-3 font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Completing..." : "Complete setup"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
