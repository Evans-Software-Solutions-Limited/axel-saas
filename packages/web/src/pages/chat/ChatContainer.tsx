import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
  type AgentStatus,
  type ChatMessage,
} from "./chatApi";
import { getRecommendedPlan } from "../planRecommendation";
import { useCheckoutSelection } from "@/hooks/useCheckoutSelection";
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

// Wraps the backend handoff greeting in a message object so the first thing the
// user sees in live mode is Axel introducing the transition, not an empty window.
const buildHandoffMessages = (
  greeting: string | undefined,
): OnboardingMessage[] => {
  if (!greeting) return [];
  return [
    {
      id: `handoff-${Date.now()}`,
      role: "assistant",
      content: greeting,
      createdAt: new Date().toISOString(),
    },
  ];
};

type ChatMode =
  | "loading"
  | "confirming-payment"
  | "discovery"
  | "onboarding"
  | "provisioning"
  | "live"
  | "failed";

const PROVISIONING_POLL_INTERVAL_MS = 3000;
// How many times to retry before giving up while confirming payment (~60 s total)
const CONFIRMING_PAYMENT_MAX_RETRIES = 20;

export function ChatContainer() {
  const [messages, setMessages] = useState<OnboardingMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("loading");
  const [nextQuestion, setNextQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Derive recommendation from real onboarding/chat signals. When messages is
  // empty (new user in discovery mode) this returns null — no badge is shown.
  const recommendation = useMemo(
    () => getRecommendedPlan({ messages }),
    [messages],
  );
  const {
    loadingTier: discoveryLoadingTier,
    error: discoveryError,
    handleSelectPlan: handleDiscoverySelectPlan,
  } = useCheckoutSelection();
  const [searchParams, setSearchParams] = useSearchParams();
  // Captured once on mount — true when user just returned from Stripe checkout.
  // Using a ref avoids re-renders and ensures the flag is consumed exactly once.
  const postCheckoutRef = useRef(searchParams.get("checkout") === "success");
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // When payment-confirm poll sees subscription active, we request a reload
  // via state so the load effect runs without a callback ref.
  const [reloadTrigger, setReloadTrigger] = useState(0);
  // Incremented on every new poll chain start and on unmount cleanup.
  // Each in-progress poll iteration captures its generation at creation time
  // and stops if the current value no longer matches, preventing duplicate chains.
  const pollingGenerationRef = useRef(0);
  const navigate = useNavigate();
  const {
    setOnboardingCompleted,
    refreshOnboardingStatus,
    onboardingCompleted,
  } = useAuth();

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
          setMessages(buildHandoffMessages(agentStatus.handoffGreeting));
          setChatMode("live");
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
  }, []);

  // Poll after checkout success: wait until the Stripe webhook has activated the
  // subscription (i.e. status is no longer "subscription_required"), then re-run
  // the normal loadState flow to hand off into onboarding / provisioning / live.
  const startConfirmingPaymentPoll = useCallback(() => {
    pollingGenerationRef.current += 1;
    const generation = pollingGenerationRef.current;
    let retries = 0;

    const poll = async () => {
      if (!mountedRef.current || pollingGenerationRef.current !== generation)
        return;
      try {
        const agentStatus = await getAgentStatus();
        if (!mountedRef.current || pollingGenerationRef.current !== generation)
          return;
        if (
          agentStatus.success &&
          agentStatus.status !== "subscription_required"
        ) {
          // Subscription is now active — request a reload so the load effect
          // runs with the latest loadState (postCheckout is already false).
          setReloadTrigger((t) => t + 1);
          return;
        }
      } catch {
        // Ignore transient errors and retry
      }
      retries += 1;
      if (retries >= CONFIRMING_PAYMENT_MAX_RETRIES) {
        if (mountedRef.current && pollingGenerationRef.current === generation) {
          setChatMode("failed");
          setError(
            "We could not confirm your payment. Please refresh the page or contact support.",
          );
        }
        return;
      }
      if (!mountedRef.current || pollingGenerationRef.current !== generation)
        return;
      pollingTimerRef.current = setTimeout(() => {
        void poll();
      }, PROVISIONING_POLL_INTERVAL_MS);
    };
    void poll();
  }, []);

  // Call the onboarding complete endpoint and switch to live or provisioning mode
  const handleCompleteOnboarding = useCallback(async () => {
    try {
      // Call the backend to complete onboarding and generate workspace files
      await completeOnboardingApi();

      setOnboardingCompleted(true);
      await refreshOnboardingStatus();

      // Check whether the agent is already active or still provisioning
      let agentStatus: AgentStatus | null = null;
      try {
        agentStatus = await getAgentStatus();
      } catch {
        // If status check fails, fall back to live mode
      }

      if (agentStatus?.success && agentStatus.status === "provisioning") {
        setChatMode("provisioning");
        startProvisioningPoll();
      } else if (agentStatus?.success && agentStatus.status === "failed") {
        setChatMode("failed");
        setError(
          "Agent setup failed. Please contact support or try again later.",
        );
      } else if (
        agentStatus?.success &&
        agentStatus.status === "subscription_required"
      ) {
        // Onboarding is done but no active subscription — send user to the
        // dedicated subscribe page rather than surfacing plan cards in chat.
        navigate("/subscribe");
      } else {
        // When the dedicated agent is confirmed active, replace the onboarding
        // transcript with the handoff greeting so the transition feels intentional.
        // For not_found or error fallbacks, keep the existing messages so the user
        // sees their onboarding context rather than a blank live-chat window.
        if (agentStatus?.success && agentStatus.status === "active") {
          setMessages(buildHandoffMessages(agentStatus.handoffGreeting));
        }
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
    setOnboardingCompleted,
    refreshOnboardingStatus,
    startProvisioningPoll,
    navigate,
  ]);

  // Load initial state - determines if onboarding or live chat
  const loadState = useCallback(async () => {
    setIsLoadingState(true);
    setError(null);

    try {
      // First check if we should be in live mode
      // Note: getAgentStatus throws for new users - we catch and fall through to onboarding
      let agentStatus: AgentStatus | null = null;
      try {
        agentStatus = await getAgentStatus();
      } catch {
        // getAgentStatus throws for new users - that's fine, fall through to onboarding
        // This is expected when user hasn't completed onboarding yet
      }

      // Handle subscription_required status from the agent endpoint.
      // GET /users/me/agent returns this when the subscription is missing or
      // in a non-active/trialing state — it is not a phantom value.
      if (
        agentStatus?.success &&
        agentStatus.status === "subscription_required"
      ) {
        // If the user just returned from Stripe checkout, the webhook may not
        // have processed yet. Poll silently until the subscription activates
        // instead of dropping them back into the plan-selection discovery panel.
        if (postCheckoutRef.current) {
          postCheckoutRef.current = false;
          // Strip the ?checkout=success param so refresh doesn't re-trigger.
          setSearchParams({}, { replace: true });
          setChatMode("confirming-payment");
          startConfirmingPaymentPoll();
          return;
        }
        // Post-onboarding users must subscribe via the dedicated /subscribe
        // page rather than seeing a duplicate plan picker inside chat.
        if (onboardingCompleted) {
          navigate("/subscribe");
          return;
        }
        // Pre-onboarding (new) users see the discovery panel inline so they
        // can pick a plan before starting the onboarding conversation.
        setChatMode("discovery");
        return;
      }

      // Determine whether the live agent is already active.
      const agentActive =
        agentStatus?.success && agentStatus.status === "active";

      if (agentActive) {
        // User has completed onboarding and has an active agent.
        // Seed the chat with a handoff greeting so the transition feels
        // intentional rather than presenting an unexplained blank window.
        setMessages(buildHandoffMessages(agentStatus?.handoffGreeting));
        setChatMode("live");
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
    // onboardingCompleted intentionally omitted: including it would re-run this
    // effect when handleCompleteOnboarding sets it to true, causing a race and
    // a "Loading…" flash. We read it in the subscription_required branch; when
    // loadState is run from the reload-trigger effect we get the latest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [
    setOnboardingCompleted,
    refreshOnboardingStatus,
    startProvisioningPoll,
    startConfirmingPaymentPoll,
    setSearchParams,
    navigate,
  ]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  // When payment poll confirms subscription is active, reload state once.
  useEffect(() => {
    if (reloadTrigger === 0) return;
    setReloadTrigger(0);
    void loadState();
  }, [reloadTrigger, loadState]);

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
        setMessages((current) => current.slice(0, -1));
        // Live mode is only reachable after onboarding; send to the dedicated
        // subscribe page rather than surfacing plan cards inside chat.
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

  const isConfirmingPaymentMode = chatMode === "confirming-payment";
  const isDiscoveryMode = chatMode === "discovery";
  const isOnboardingMode = chatMode === "onboarding";
  const isProvisioningMode = chatMode === "provisioning";
  const isFailedMode = chatMode === "failed";

  return (
    <ChatPresenter
      messages={messages}
      input={input}
      isLoadingState={isLoadingState}
      isSending={isSending}
      isConfirmingPaymentMode={isConfirmingPaymentMode}
      isDiscoveryMode={isDiscoveryMode}
      isOnboardingMode={isOnboardingMode}
      isProvisioningMode={isProvisioningMode}
      isFailedMode={isFailedMode}
      nextQuestion={nextQuestion}
      error={error}
      discoveryRecommendation={recommendation}
      discoveryLoadingTier={discoveryLoadingTier}
      discoveryError={discoveryError}
      onDiscoverySelectPlan={handleDiscoverySelectPlan}
      onInputChange={setInput}
      onSend={() => {
        void handleSend();
      }}
    />
  );
}
