import { useEffect, useRef } from "react";
import { IconSend } from "@tabler/icons-react";
import { Button } from "@axel-saas/ui/button";
import { Input } from "@axel-saas/ui/input";
import type { OnboardingMessage } from "./onboardingApi";
import { DiscoveryPanel } from "./DiscoveryPanel";
import type { Recommendation } from "../planRecommendation";

// Support both onboarding and live chat messages
type Message = OnboardingMessage;

interface ChatPresenterProps {
  messages: Message[];
  input: string;
  isLoadingState: boolean;
  isSending: boolean;
  isConfirmingPaymentMode: boolean;
  isDiscoveryMode: boolean;
  isOnboardingMode: boolean;
  isProvisioningMode: boolean;
  isFailedMode: boolean;
  nextQuestion: string | null;
  error: string | null;
  discoveryRecommendation: Recommendation | null;
  discoveryLoadingTier: string | null;
  discoveryError: string | null;
  onDiscoverySelectPlan: (tierId: string | null) => void;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatPresenter({
  messages,
  input,
  isLoadingState,
  isSending,
  isConfirmingPaymentMode,
  isDiscoveryMode,
  isOnboardingMode,
  isProvisioningMode,
  isFailedMode,
  nextQuestion,
  error,
  discoveryRecommendation,
  discoveryLoadingTier,
  discoveryError,
  onDiscoverySelectPlan,
  onInputChange,
  onSend,
}: ChatPresenterProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsSendingRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (prevIsSendingRef.current && !isSending) {
      inputRef.current?.focus();
    }
    prevIsSendingRef.current = isSending;
  }, [isSending]);

  const canSend =
    input.trim().length > 0 &&
    !isLoadingState &&
    !isSending &&
    !isConfirmingPaymentMode &&
    !isDiscoveryMode &&
    !isProvisioningMode &&
    !isFailedMode;

  // Only show nextQuestion banner if the same question isn't already in the transcript.
  // Extract the core question from nextQuestion to handle cases where the transcript wraps
  // the question in greeting text (e.g., transcript has "what should I call you?" but
  // nextQuestion has "Before I can be useful, what should I call you?").
  const getCoreQuestion = (question: string): string => {
    // Split by common delimiters and find the last non-empty meaningful part
    // Handles: "Before I can be useful, what should I call you?" -> "what should I call you?"
    const parts = question
      .split(/[,?]/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts[parts.length - 1] || question;
  };

  const coreNextQuestion = nextQuestion
    ? getCoreQuestion(nextQuestion).toLowerCase()
    : "";

  const showNextQuestion =
    nextQuestion &&
    !messages.some((msg) => {
      if (msg.role !== "assistant") return false;
      const msgContent = msg.content.toLowerCase();
      // Check if the core question appears anywhere in the transcript message
      return msgContent.includes(coreNextQuestion);
    });

  // Input is disabled during loading, when already sending, when in confirming-payment/discovery/provisioning/failed, or when there's an error
  const inputDisabled =
    isLoadingState ||
    isSending ||
    isConfirmingPaymentMode ||
    isDiscoveryMode ||
    isProvisioningMode ||
    isFailedMode ||
    error !== null;

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          {isConfirmingPaymentMode
            ? "Payment confirmed"
            : isDiscoveryMode
              ? "Choose your plan"
              : isOnboardingMode
                ? "Onboarding mode"
                : isProvisioningMode
                  ? "Setting up"
                  : isFailedMode
                    ? "Setup failed"
                    : "Chat"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {isLoadingState && <p className="text-sm text-muted">Loading...</p>}

        {isConfirmingPaymentMode && (
          <p className="text-sm text-muted">
            Payment confirmed. Activating your workspace — this usually takes
            just a moment...
          </p>
        )}

        {isDiscoveryMode && (
          <DiscoveryPanel
            recommendation={discoveryRecommendation}
            onSelectPlan={onDiscoverySelectPlan}
            loadingTier={discoveryLoadingTier}
            error={discoveryError}
          />
        )}

        {isProvisioningMode && (
          <p className="text-sm text-muted">
            Your agent is being set up. This usually takes just a moment...
          </p>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        {showNextQuestion && (
          <div className="bg-surface-raised border border-border rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-muted mb-2">
              Next question
            </p>
            <p className="text-sm text-text">{nextQuestion}</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-none"
                  : "bg-surface-raised text-text rounded-bl-none"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder={
            isConfirmingPaymentMode
              ? "Activating your workspace..."
              : isDiscoveryMode
                ? "Pick a plan above to get started"
                : isOnboardingMode
                  ? "Answer Axel's question..."
                  : isProvisioningMode
                    ? "Setting up your agent..."
                    : isFailedMode
                      ? "Agent setup failed — chat unavailable"
                      : "Ask Axel to help..."
          }
          className="bg-surface-raised border-border text-text"
          disabled={inputDisabled}
        />
        <Button
          onClick={onSend}
          className="bg-accent hover:bg-accent/90 text-white px-4"
          disabled={!canSend}
        >
          <IconSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
