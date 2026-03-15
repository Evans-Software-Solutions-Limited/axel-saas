import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  getOnboardingState,
  OnboardingAlreadyCompleteError,
  postOnboardingMessage,
  completeOnboarding as completeOnboardingApi,
  type OnboardingMessage,
} from "./onboardingApi";
import {
  getAgentStatus,
  postChatMessage,
  SubscriptionRequiredError,
  type ChatMessage,
} from "./chatApi";
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

type ChatMode = "loading" | "onboarding" | "provisioning" | "live" | "failed";

const PROVISIONING_POLL_INTERVAL_MS = 3000;

export function ChatContainer() {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("loading");
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Incremented on every new poll chain start and on unmount cleanup.
  // Each in-progress poll iteration captures its generation at creation time
  // and stops if the current value no longer matches, preventing duplicate chains.
  const pollingGenerationRef = useRef(0);
  const { setOnboardingCompleted, refreshOnboardingStatus } = useAuth();
  const navigate = useNavigate();

  // Poll agent status until it becomes active, then switch to live mode.
  // A generation counter ensures that only one chain runs at a time: each call
  // increments the counter, and any in-progress iteration from a prior call
  // detects the mismatch and stops without rescheduling.
  const startProvisioningPoll = useCallback(() => {
    pollingGenerationRef.current += 1;
    const generation = pollingGenerationRef.current;

    const poll = async () => {
      if (!mountedRef.current || pollingGenerationRef.current !== generation)
        return;
      try {
        const agentStatus = await getAgentStatus();
        if (!mountedRef.current || pollingGenerationRef.current !== generation)
          return;
        if (agentStatus.success && agentStatus.status === "active") {
          setChatMode("live");
          setMessages([]);
          return;
        }
        if (
          agentStatus.success &&
          agentStatus.status === "subscription_required"
        ) {
          navigate("/subscribe");
          return;
        }
        if (agentStatus.success && agentStatus.status === "failed") {
          setChatMode("failed");
          setError(
            "Agent setup failed. Please contact support or try again later.",
          );
          return;
        }
      } catch {
        // Ignore poll errors and retry
      }
      if (!mountedRef.current || pollingGenerationRef.current !== generation)
        return;
      pollingTimerRef.current = setTimeout(() => {
        void poll();
      }, PROVISIONING_POLL_INTERVAL_MS);
    };
    void poll();
  }, [navigate]);

  // Call the onboarding complete endpoint and switch to live or provisioning mode
  const handleCompleteOnboarding = useCallback(async () => {
    try {
      // Call the backend to complete onboarding and generate workspace files
      await completeOnboardingApi();

      setOnboardingCompleted(true);
      await refreshOnboardingStatus();

      // Check whether the agent is already active or still provisioning
      let agentStatus: { success: boolean; status: string } | null = null;
      try {
        agentStatus = await getAgentStatus();
      } catch {
        // If status check fails, fall back to live mode
      }

      if (agentStatus?.success && agentStatus.status === "provisioning") {
        setChatMode("provisioning");
        startProvisioningPoll();
      } else if (
        agentStatus?.success &&
        agentStatus.status === "subscription_required"
      ) {
        navigate("/subscribe");
      } else if (agentStatus?.success && agentStatus.status === "failed") {
        setChatMode("failed");
        setError(
          "Agent setup failed. Please contact support or try again later.",
        );
      } else {
        setChatMode("live");
      }
    } catch (err) {
      // If onboarding completion fails, do NOT mark it as complete
      // The user should retry or contact support
      const message =
        err instanceof Error ? err.message : "Failed to complete onboarding";
      setError(message);
      // Don't switch mode; stay in onboarding mode to allow retry
    }
  }, [
    navigate,
    setOnboardingCompleted,
    refreshOnboardingStatus,
    startProvisioningPoll,
  ]);

  // Load initial state - determines if onboarding or live chat
  const loadState = useCallback(async () => {
    setIsLoadingState(true);
    setError(null);

    try {
      // First check if we should be in live mode
      // Note: getAgentStatus throws for new users - we catch and fall through to onboarding
      let agentStatus: { success: boolean; status: string } | null = null;
      try {
        agentStatus = await getAgentStatus();
      } catch {
        // getAgentStatus throws for new users - that's fine, fall through to onboarding
        // This is expected when user hasn't completed onboarding yet
      }

      // Redirect to subscribe if payment is required
      if (
        agentStatus?.success &&
        agentStatus.status === "subscription_required"
      ) {
        navigate("/subscribe");
        return;
      }

      // Determine whether the live agent is already active.
      const agentActive =
        agentStatus?.success && agentStatus.status === "active";

      if (agentActive) {
        // User has completed onboarding and has an active agent
        setChatMode("live");
        // Initialize with empty messages for live chat
        setMessages([]);
        return;
      }

      // If provisioning failed, show the error state — do not poll
      if (agentStatus?.success && agentStatus.status === "failed") {
        setChatMode("failed");
        setError(
          "Agent setup failed. Please contact support or try again later.",
        );
        return;
      }

      // If the agent is provisioning, show the provisioning state and poll until active
      const agentProvisioning =
        agentStatus?.success && agentStatus.status === "provisioning";

      if (agentProvisioning) {
        setOnboardingCompleted(true);
        await refreshOnboardingStatus();
        setChatMode("provisioning");
        startProvisioningPoll();
        return;
      }

      // Check if onboarding is completed on the backend
      const result = await getOnboardingState();

      // If onboarding is complete (regardless of agent provisioning state),
      // go to live mode. The agent may still be provisioning in the background.
      if (!result.state || result.state.status === "completed") {
        // Onboarding is done - switch to live mode
        // Don't re-trigger onboarding completion here - that causes a loop
        // when agent exists but gatewayUrl isn't set yet (provisioning in progress)
        setOnboardingCompleted(true);
        await refreshOnboardingStatus();
        setChatMode("live");
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
  }, [
    navigate,
    setOnboardingCompleted,
    refreshOnboardingStatus,
    startProvisioningPoll,
  ]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // Clean up any pending poll timer on unmount and guard async continuations.
  // Incrementing pollingGenerationRef cancels any in-flight poll iteration
  // that resolves after the component is gone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollingGenerationRef.current += 1;
      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

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
        await handleCompleteOnboarding();
      }
    } catch (sendError) {
      if (sendError instanceof OnboardingAlreadyCompleteError) {
        await handleCompleteOnboarding();
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
  }, [handleCompleteOnboarding, chatMode, input, isSending]);

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
      if (sendError instanceof SubscriptionRequiredError) {
        navigate("/subscribe");
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
  }, [chatMode, input, isSending, navigate]);

  const handleSend = useCallback(() => {
    if (chatMode === "onboarding") {
      void handleOnboardingSend();
    } else if (chatMode === "live") {
      void handleLiveSend();
    }
  }, [chatMode, handleOnboardingSend, handleLiveSend]);

  const isOnboardingMode = chatMode === "onboarding";
  const isProvisioningMode = chatMode === "provisioning";
  const isFailedMode = chatMode === "failed";

  return (
    <ChatPresenter
      messages={messages}
      input={input}
      isLoadingState={isLoadingState}
      isSending={isSending}
      isOnboardingMode={isOnboardingMode}
      isProvisioningMode={isProvisioningMode}
      isFailedMode={isFailedMode}
      nextQuestion={nextQuestion}
      error={error}
      onInputChange={setInput}
      onSend={() => {
        void handleSend();
      }}
    />
  );
}
