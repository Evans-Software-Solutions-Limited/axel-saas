import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IconSend, IconCircleCheckFilled } from "@tabler/icons-react";

type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6;

interface OnboardingState {
  name: string;
  role: string;
  goals: string;
  helpWith: string;
  painPoints: string;
  knowledgeAreas: string;
}

interface Message {
  type: "axel" | "user";
  content: string;
}

const QUESTIONS = [
  {
    step: 1 as OnboardingStep,
    prompt: "Hey! I'm Axel. What's your name?",
    key: "name" as const,
    placeholder: "Your name",
  },
  {
    step: 2 as OnboardingStep,
    prompt:
      "Great to meet you, {name}. What do you do — work, passion project, side hustle, whatever feels right.",
    key: "role" as const,
    placeholder: "Your role or work",
  },
  {
    step: 3 as OnboardingStep,
    prompt:
      "What matters most to you right now? Could be something you're working toward, something you're trying to fix, anything.",
    key: "goals" as const,
    placeholder: "Your goals",
  },
  {
    step: 4 as OnboardingStep,
    prompt: "What kinds of things would you want my help with day to day?",
    key: "helpWith" as const,
    placeholder: "How I can help you",
  },
  {
    step: 5 as OnboardingStep,
    prompt: "Any pain points — stuff that eats your time or drives you mad?",
    key: "painPoints" as const,
    placeholder: "Your pain points",
  },
  {
    step: 6 as OnboardingStep,
    prompt:
      "Last one — are there things you'd want to teach me? Things I should become knowledgeable about for you? Could be your business, a subject area, policies, anything.",
    key: "knowledgeAreas" as const,
    placeholder: "Knowledge areas",
  },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { type: "axel", content: QUESTIONS[0].prompt },
  ]);
  const [state, setState] = useState<OnboardingState>({
    name: "",
    role: "",
    goals: "",
    helpWith: "",
    painPoints: "",
    knowledgeAreas: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getCurrentQuestion = () => {
    return QUESTIONS.find((q) => q.step === currentStep);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    const question = getCurrentQuestion();
    if (!question) return;

    // Add user message
    setMessages((prev) => [...prev, { type: "user", content: input }]);
    setInput("");

    // Update state
    setState((prev) => ({
      ...prev,
      [question.key]: input,
    }));

    // Move to next step
    if (currentStep < 6) {
      const nextQuestion = QUESTIONS[currentStep];
      const nextPrompt = nextQuestion.prompt.replace(
        "{name}",
        input.length > 0 ? input : state.name,
      );

      // Small delay for UX
      setTimeout(() => {
        setMessages((prev) => [...prev, { type: "axel", content: nextPrompt }]);
        setCurrentStep((currentStep + 1) as OnboardingStep);
      }, 300);
    } else {
      // Final submission
      setMessages((prev) => [
        ...prev,
        {
          type: "axel",
          content: `Thanks ${input}, I'm getting set up for you...`,
        },
      ]);
      submitOnboarding(input);
    }
  };

  const submitOnboarding = async (finalName: string) => {
    setLoading(true);
    setSubmitted(true);

    try {
      const onboardingData = {
        name: state.name || finalName,
        role: state.role,
        goals: state.goals,
        helpWith: state.helpWith,
        painPoints: state.painPoints,
        knowledgeAreas: state.knowledgeAreas,
      };

      const response = await fetch("/api/users/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(onboardingData),
      });

      if (!response.ok) {
        throw new Error("Failed to complete onboarding");
      }

      // Redirect to dashboard after a brief delay
      setTimeout(() => {
        navigate("/dashboard");
      }, 1500);
    } catch (error) {
      console.error("Onboarding submission error:", error);
      setSubmitted(false);
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          type: "axel",
          content:
            "Oops, something went wrong. Let me try that again. Ready to continue?",
        },
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-surface to-surface-raised flex flex-col">
      {/* Header with progress */}
      <div className="sticky top-0 z-10 bg-surface/80 backdrop-blur border-b border-border p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚡</span>
            <span className="font-semibold text-text">Axel</span>
          </div>
          <div className="text-sm text-muted">
            {currentStep} of 6
            <div className="w-48 h-1 bg-border rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${(currentStep / 6) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="max-w-2xl mx-auto w-full">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 mb-4 ${
                msg.type === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {msg.type === "axel" && (
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-lg">⚡</span>
                </div>
              )}

              <div
                className={`max-w-xs rounded-lg px-4 py-3 ${
                  msg.type === "axel"
                    ? "bg-surface-raised text-text border border-border"
                    : "bg-accent text-white"
                }`}
              >
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {submitted && (
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-1">
                <IconCircleCheckFilled className="w-5 h-5 text-accent" />
              </div>
              <div className="bg-surface-raised text-text border border-border rounded-lg px-4 py-3 flex items-center gap-2">
                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <span className="text-sm">Setting up your workspace...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {!submitted && (
        <div className="sticky bottom-0 bg-surface/80 backdrop-blur border-t border-border p-4">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your answer..."
                className="bg-surface-raised border-border text-text flex-1"
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={!input.trim() || loading}
                className="bg-accent hover:bg-accent/90 text-white px-4"
              >
                <IconSend className="w-4 h-4" />
              </Button>
            </form>
            <p className="text-xs text-muted mt-2">
              Press Enter or click Send to continue
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Onboarding;
