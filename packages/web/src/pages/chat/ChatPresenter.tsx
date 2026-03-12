import { useEffect, useRef } from "react";
import { IconSend } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OnboardingMessage } from "./onboardingApi";

interface ChatPresenterProps {
  messages: OnboardingMessage[];
  input: string;
  isLoadingState: boolean;
  isSending: boolean;
  isOnboardingMode: boolean;
  nextQuestion: string | null;
  error: string | null;
  onInputChange: (value: string) => void;
  onSend: () => void;
}

export function ChatPresenter({
  messages,
  input,
  isLoadingState,
  isSending,
  isOnboardingMode,
  nextQuestion,
  error,
  onInputChange,
  onSend,
}: ChatPresenterProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canSend = input.trim().length > 0 && !isLoadingState && !isSending;

  // Only show nextQuestion if it's not already in the messages (to avoid duplicates)
  // Use fuzzy matching: check if nextQuestion is contained in any assistant message,
  // or if any assistant message contains the nextQuestion (handles greeting + question wrapping)
  const showNextQuestion =
    nextQuestion &&
    !messages.some((msg) => {
      if (msg.role !== "assistant") return false;
      const msgLower = msg.content.toLowerCase();
      const questionLower = nextQuestion.toLowerCase();
      return (
        msgLower === questionLower ||
        msgLower.includes(questionLower) ||
        questionLower.includes(msgLower)
      );
    });

  return (
    <div className="h-full flex flex-col p-6">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-wide text-muted">
          {isOnboardingMode ? "Onboarding mode" : "Chat"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {isLoadingState && (
          <p className="text-sm text-muted">Loading onboarding state...</p>
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
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Tell Axel what to do..."
          className="bg-surface-raised border-border text-text"
          disabled={!isOnboardingMode || isLoadingState || isSending}
        />
        <Button
          onClick={onSend}
          className="bg-accent hover:bg-accent/90 text-white px-4"
          disabled={!canSend || !isOnboardingMode}
        >
          <IconSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
