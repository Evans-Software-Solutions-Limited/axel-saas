import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  getOnboardingState,
  OnboardingAlreadyCompleteError,
  type OnboardingMessage,
  postOnboardingMessage,
} from "./onboardingApi";
import { getAgentStatus, postChatMessage, type ChatMessage } from "./chatApi";
import { ChatPresenter } from "./ChatPresenter";

const toOptimisticOnboardingMessage = (content: string): OnboardingMessage => ({
  id: `user-optimistic-${Date.now()}`,
  role: "user",
  content,
  createdAt: new Date().toISOString(),
});

const toOptimisticChatMessage = (content: string): ChatMessage => ({
  id: `user-optimistic-${Date.now()}`,
  role: "user",
  content,
  createdAt: new Date().toISOString(),
});

type ChatMode = "loading" | "onboarding" | "live";

export function ChatContainer() {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("loading");
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { setOnboardingCompleted, refreshOnboardingStatus } = useAuth();

  // Call the onboarding complete endpoint and switch to live mode
  const completeOnboarding = useCallback(async () => {
    try {
      // Call the backend to complete onboarding and generate workspace files
      const completeResponse = await fetch("/api/users/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json();
        console.error("Onboarding complete error:", errorData);
        // Continue anyway - the agent is still usable
      }

      // Switch to live mode instead of navigating away
      setOnboardingCompleted(true);
      await refreshOnboardingStatus();
      setChatMode("live");
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      // Still switch to live mode - the user can chat
      setChatMode("live");
    }
  }, [setOnboardingCompleted, refreshOnboardingStatus]);

  // Load initial state - determines if onboarding or live chat
  const loadState = useCallback(async () => {
    setIsLoadingState(true);
    setError(null);

    try {
      // First check if we should be in live mode
      const agentStatus = await getAgentStatus();

      if (agentStatus.success && agentStatus.status === "active") {
        // User has completed onboarding and has an active agent
        setChatMode("live");
        // Initialize with empty messages for live chat
        setMessages([]);
        return;
      }

      // Otherwise, check onboarding state
      const result = await getOnboardingState();

      if (!result.state || result.state.status === "completed") {
        // Onboarding is done but agent might not be provisioned yet
        // Try to complete onboarding to set up the agent
        await completeOnboarding();
        return;
      }

      // In onboarding mode
      setChatMode("onboarding");
      setMessages(result.messages);
      setNextQuestion(result.nextQuestion);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Failed to load state";
      setError(message);
      setMessages([]);
    } finally {
      setIsLoadingState(false);
    }
  }, [completeOnboarding]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Handle sending messages in onboarding mode
  const handleOnboardingSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || chatMode !== "onboarding") return;

    setError(null);
    setInput("");
    setIsSending(true);
    setMessages((current) => [
      ...current,
      toOptimisticOnboardingMessage(trimmed),
    ]);

    try {
      const result = await postOnboardingMessage(trimmed);
      setMessages(result.messages);
      setNextQuestion(result.nextQuestion);
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
          : "Failed to send message";
      setError(message);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [completeOnboarding, chatMode, input, isSending]);

  // Handle sending messages in live chat mode
  const handleLiveSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || chatMode !== "live") return;

    setError(null);
    setInput("");
    setIsSending(true);
    setMessages((current) => [...current, toOptimisticChatMessage(trimmed)]);

    try {
      const result = await postChatMessage(trimmed);

      // Add assistant response
      const assistantMessage: ChatMessage = {
        id: result.messageId || `assistant-${Date.now()}`,
        role: "assistant",
        content: result.response,
        createdAt: new Date().toISOString(),
      };

      setMessages((current) => [...current, assistantMessage]);
    } catch (sendError) {
      const message =
        sendError instanceof Error
          ? sendError.message
          : "Failed to send message";
      setError(message);
      setMessages((current) => current.slice(0, -1));
    } finally {
      setIsSending(false);
    }
  }, [chatMode, input, isSending]);

  const handleSend = useCallback(() => {
    if (chatMode === "onboarding") {
      handleOnboardingSend();
    } else if (chatMode === "live") {
      handleLiveSend();
    }
  }, [chatMode, handleOnboardingSend, handleLiveSend]);

  const isOnboardingMode = chatMode === "onboarding";

  return (
    <ChatPresenter
      messages={messages}
      input={input}
      isLoadingState={isLoadingState}
      isSending={isSending}
      isOnboardingMode={isOnboardingMode}
      nextQuestion={nextQuestion}
      error={error}
      onInputChange={setInput}
      onSend={() => {
        void handleSend();
      }}
    />
  );
}
