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
  const getCoreQuestion = (question: string): string => {
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
      return msgContent.includes(coreNextQuestion);
    });

  const inputDisabled =
    isLoadingState ||
    isSending ||
    isConfirmingPaymentMode ||
    isDiscoveryMode ||
    isProvisioningMode ||
    isFailedMode ||
    error !== null;

  const modeLabel = isConfirmingPaymentMode
    ? "Payment confirmed"
    : isDiscoveryMode
      ? "Choose your plan"
      : isOnboardingMode
        ? "Onboarding mode"
        : isProvisioningMode
          ? "Setting up"
          : isFailedMode
            ? "Setup failed"
            : "Chat";

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-muted font-medium">
          {modeLabel}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-5 space-y-4">
        {isLoadingState && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-glow-pulse" />
            <p className="text-sm text-text-secondary">Loading...</p>
          </div>
        )}

        {isConfirmingPaymentMode && (
          <p className="text-sm text-text-secondary">
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
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-glow-pulse" />
            <p className="text-sm text-text-secondary">
              Your agent is being set up. This usually takes just a moment...
            </p>
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {showNextQuestion && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-muted font-medium mb-2">
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
              className={`max-w-xs px-4 py-3 rounded-2xl ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-accent to-accent/80 text-[#08090d] rounded-br-md"
                  : "glass-card rounded-bl-md"
              }`}
            >
              <p className="text-sm leading-relaxed">{msg.content}</p>
              <p
                className={`text-xs mt-1.5 ${
                  msg.role === "user" ? "text-[#08090d]/60" : "text-muted"
                }`}
              >
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
          className="bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30 transition-all duration-200"
          disabled={inputDisabled}
        />
        <Button onClick={onSend} className="px-4" disabled={!canSend}>
          <IconSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
