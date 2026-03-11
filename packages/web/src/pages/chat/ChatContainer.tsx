import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  getOnboardingState,
  OnboardingAlreadyCompleteError,
  type OnboardingMessage,
  postOnboardingMessage,
} from "./onboardingApi";
import { ChatPresenter } from "./ChatPresenter";

const toSyntheticAssistantMessage = (content: string): OnboardingMessage => ({
  id: `assistant-next-question-${Date.now()}`,
  role: "assistant",
  content,
  createdAt: new Date().toISOString(),
});

const toOptimisticUserMessage = (content: string): OnboardingMessage => ({
  id: `user-optimistic-${Date.now()}`,
  role: "user",
  content,
  createdAt: new Date().toISOString(),
});

export function ChatContainer() {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isOnboardingMode, setIsOnboardingMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { setOnboardingCompleted, refreshOnboardingStatus } = useAuth();

  const completeOnboarding = useCallback(async () => {
    setIsOnboardingMode(false);
    setOnboardingCompleted?.(true);
    await refreshOnboardingStatus?.();
    navigate("/dashboard/office", { replace: true });
  }, [navigate, refreshOnboardingStatus, setOnboardingCompleted]);

  const loadState = useCallback(async () => {
    setIsLoadingState(true);
    setError(null);

    try {
      const result = await getOnboardingState();

      if (!result.state || result.state.status === "completed") {
        await completeOnboarding();
        return;
      }

      setIsOnboardingMode(true);

      if (result.messages.length > 0) {
        setMessages(result.messages);
      } else if (result.nextQuestion) {
        setMessages([toSyntheticAssistantMessage(result.nextQuestion)]);
      } else {
        setMessages([]);
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load onboarding state";
      setError(message);
      setMessages([]);
    } finally {
      setIsLoadingState(false);
    }
  }, [completeOnboarding]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || !isOnboardingMode) return;

    setError(null);
    setInput("");
    setIsSending(true);
    setMessages((current) => [...current, toOptimisticUserMessage(trimmed)]);

    try {
      const result = await postOnboardingMessage(trimmed);
      setMessages(result.messages);
      if (result.isComplete || result.state.status === "completed") {
        await completeOnboarding();
      }
    } catch (sendError) {
      if (sendError instanceof OnboardingAlreadyCompleteError) {
        await completeOnboarding();
        return;
      }

      const message =
        sendError instanceof Error
          ? sendError.message
          : "Failed to send onboarding message";
      setError(message);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [completeOnboarding, input, isOnboardingMode, isSending]);

  return (
    <ChatPresenter
      messages={messages}
      input={input}
      isLoadingState={isLoadingState}
      isSending={isSending}
      isOnboardingMode={isOnboardingMode}
      error={error}
      onInputChange={setInput}
      onSend={() => {
        void handleSend();
      }}
    />
  );
}
