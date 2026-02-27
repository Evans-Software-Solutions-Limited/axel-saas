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
    <div className="min-h-screen bg-[#12141f]">
      {/* Header */}
      <div className="border-b border-[#2a2d3e] bg-[#1a1d2e] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
              ⚡
            </div>
            <h1 className="text-2xl font-bold text-white">Axel</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-[#8b8fa8] hover:text-white hover:bg-[#252840] transition-colors duration-150"
          >
            <IconLogout size={20} />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-2xl mx-auto p-8 mt-8">
        {/* Step indicator */}
        <div className="mb-12 flex items-center justify-center gap-2">
          {STEP_LABELS.map((_, index) => (
            <div key={index} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-150 ${
                  index <= currentStep
                    ? index < currentStep
                      ? "bg-indigo-500 text-white"
                      : "border-2 border-indigo-500 text-indigo-400"
                    : "bg-[#252840] text-[#8b8fa8]"
                }`}
              >
                {index < currentStep ? "✓" : index + 1}
              </div>
              {index < STEP_LABELS.length - 1 && (
                <div
                  className={`w-8 h-0.5 transition-all duration-150 ${
                    index < currentStep ? "bg-indigo-500" : "bg-[#2a2d3e]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Main card */}
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-2xl p-8">
          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-500/20 p-4 text-red-300 border border-red-500/30">
              {error}
            </div>
          )}

          {/* Content based on step */}
          {currentStep === 0 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What's your name?
              </h2>
              <p className="text-[#8b8fa8] mb-6">What should I call you?</p>
              <input
                type="text"
                value={data.name}
                onChange={(e) => updateData({ name: e.target.value })}
                placeholder="Your name"
                className="w-full rounded-lg bg-[#252840] px-4 py-3 text-white placeholder-[#8b8fa8] border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150"
                autoFocus
              />
            </div>
          )}

          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                What do you do for work?
              </h2>
              <p className="text-[#8b8fa8] mb-6">
                Brief description of your role
              </p>
              <input
                type="text"
                value={data.role || ""}
                onChange={(e) => updateData({ role: e.target.value })}
                placeholder="e.g., Founder at startup, Software engineer, etc."
                className="w-full rounded-lg bg-[#252840] px-4 py-3 text-white placeholder-[#8b8fa8] border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150 mb-6"
                autoFocus
              />
              <div className="space-y-2">
                <p className="text-sm text-[#8b8fa8] mb-3">Or select a role:</p>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      onClick={() => updateData({ role })}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                        data.role === role
                          ? "bg-indigo-500 text-white"
                          : "bg-[#252840] text-[#8b8fa8] border border-[#2a2d3e] hover:border-indigo-500"
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
              <h2 className="text-2xl font-bold text-white mb-2">
                What do you mainly want help with?
              </h2>
              <p className="text-[#8b8fa8] mb-6">Select all that apply</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {HELP_WITH_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => toggleHelpWith(option)}
                    className={`rounded-lg px-4 py-3 text-left font-medium transition-colors duration-150 border ${
                      data.helpWith.includes(option)
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-[#252840] text-[#8b8fa8] border-[#2a2d3e] hover:border-indigo-500"
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
              <h2 className="text-2xl font-bold text-white mb-2">
                What does a typical day look like?
              </h2>
              <p className="text-[#8b8fa8] mb-4">
                Optional — helps me understand your context
              </p>
              <textarea
                value={data.typicalDay || ""}
                onChange={(e) => updateData({ typicalDay: e.target.value })}
                placeholder="Describe your typical day (e.g., client calls, emails, coding, meetings)"
                className="w-full rounded-lg bg-[#252840] px-4 py-3 text-white placeholder-[#8b8fa8] border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150 h-32 resize-none"
                autoFocus
              />
            </div>
          )}

          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Which channels would you like to use?
              </h2>
              <p className="text-[#8b8fa8] mb-6">Select all that apply</p>
              <div className="space-y-3">
                {CHANNEL_OPTIONS.map((channel) => (
                  <button
                    key={channel}
                    onClick={() => toggleChannel(channel)}
                    className={`w-full rounded-lg px-4 py-3 text-left font-medium transition-colors duration-150 border ${
                      data.channels.includes(channel)
                        ? "bg-indigo-500 text-white border-indigo-500"
                        : "bg-[#252840] text-[#8b8fa8] border-[#2a2d3e] hover:border-indigo-500"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{channel}</span>
                      {channel === "Telegram" && (
                        <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
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
              <h2 className="text-2xl font-bold text-white mb-2">
                ⚡ Your assistant is ready
              </h2>
              <p className="text-[#8b8fa8] mb-6">
                Review your setup and launch Axel
              </p>

              {/* Summary */}
              <div className="bg-[#252840] rounded-lg p-4 mb-6 space-y-3">
                <div>
                  <p className="text-xs text-[#8b8fa8]">Name</p>
                  <p className="text-sm text-white font-medium">{data.name}</p>
                </div>
                {data.role && (
                  <div>
                    <p className="text-xs text-[#8b8fa8]">Role</p>
                    <p className="text-sm text-white font-medium">
                      {data.role}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-[#8b8fa8]">Help with</p>
                  <p className="text-sm text-white font-medium">
                    {data.helpWith.join(", ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8b8fa8]">Channels</p>
                  <p className="text-sm text-white font-medium">
                    {data.channels.join(", ")}
                  </p>
                </div>
              </div>

              {/* Confirm button */}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-indigo-500 text-white py-3 rounded-lg font-medium hover:bg-indigo-600 disabled:bg-indigo-500/50 transition-colors duration-150"
              >
                {isSubmitting ? "Launching..." : "Launch Axel"}
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          {currentStep < 5 && (
            <div className="mt-8 flex gap-4">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="flex-1 rounded-lg px-4 py-3 font-medium text-white bg-[#252840] border border-[#2a2d3e] hover:bg-[#2d3050] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Previous
              </button>

              <button
                onClick={handleNext}
                disabled={!canProceedToNext}
                className="flex-1 rounded-lg px-4 py-3 font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
