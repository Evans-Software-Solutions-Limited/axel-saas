import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Chat } from "../Chat";
import {
  completeOnboarding,
  getOnboardingState,
  postOnboardingMessage,
  OnboardingAlreadyCompleteError,
} from "../chat/onboardingApi";
import {
  getAgentStatus,
  postChatMessage,
  SubscriptionRequiredError,
} from "../chat/chatApi";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

const { onboardingCompletePostMock } = vi.hoisted(() => ({
  onboardingCompletePostMock: vi.fn(),
}));

vi.mock("react-router", async () => {
  const actual = await import("react-router");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/eden", () => ({
  api: {
    core: {
      users: {
        onboarding: {
          complete: {
            post: onboardingCompletePostMock,
          },
        },
      },
    },
  },
}));

vi.mock("../chat/onboardingApi", () => ({
  completeOnboarding: vi.fn(),
  getOnboardingState: vi.fn(),
  postOnboardingMessage: vi.fn(),
  OnboardingAlreadyCompleteError: class OnboardingAlreadyCompleteError extends Error {},
}));

vi.mock("../chat/chatApi", () => ({
  getAgentStatus: vi.fn(),
  postChatMessage: vi.fn(),
  SubscriptionRequiredError: class SubscriptionRequiredError extends Error {
    constructor() {
      super("subscription_required");
      this.name = "SubscriptionRequiredError";
    }
  },
}));

describe("Chat onboarding integration", () => {
  const setOnboardingCompleted = vi.fn();
  const refreshOnboardingStatus = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    // Default: no active agent - will fall through to onboarding
    vi.mocked(getAgentStatus).mockResolvedValue({
      success: true,
      status: "not_found",
    });
    // Mock Eden client for onboarding complete endpoint
    onboardingCompletePostMock.mockResolvedValue({
      data: { success: true },
    });
    vi.mocked(completeOnboarding).mockResolvedValue({
      success: true,
      message: "Onboarding completed",
    });
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      onboardingCompleted: false,
      setOnboardingCompleted,
      refreshOnboardingStatus,
      user: { id: "user-1", email: "test@example.com" },
      session: {} as never,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it("loads incomplete onboarding state on first render", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["role"],
        collectedAnswers: { name: "Bradley" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "What do you do for work?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: "What do you do for work?",
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Onboarding mode")).toBeDefined();
    expect(await screen.findByText("What do you do for work?")).toBeDefined();
    expect(
      screen.getByPlaceholderText(/answer axel's question/i),
    ).toBeDefined();
  });

  it("restores persisted onboarding transcript after refresh", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T09:55:00.000Z",
        },
        {
          id: "m2",
          role: "user",
          content: "Bradley",
          createdAt: "2026-03-11T09:56:00.000Z",
        },
      ],
      nextQuestion: "Which channels would you like to use?",
    });

    const firstRender = render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );
    expect(await screen.findByText("What should I call you?")).toBeDefined();
    expect(screen.getByText("Bradley")).toBeDefined();

    firstRender.unmount();

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByText("What should I call you?")).toBeDefined();
    expect(screen.getByText("Bradley")).toBeDefined();
    expect(getOnboardingState).toHaveBeenCalledTimes(2);
  });

  it("posts onboarding message and renders backend response transcript", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["role"],
        collectedAnswers: {},
        completedAt: null,
        lastMessageAt: null,
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T10:03:30.000Z",
        },
      ],
      nextQuestion: "What should I call you?",
    });

    vi.mocked(postOnboardingMessage).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:05:00.000Z",
      },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T10:04:00.000Z",
        },
        {
          id: "m2",
          role: "user",
          content: "Bradley",
          createdAt: "2026-03-11T10:04:30.000Z",
        },
        {
          id: "m3",
          role: "assistant",
          content: "What do you do for work?",
          createdAt: "2026-03-11T10:05:00.000Z",
        },
      ],
      assistantResponse: "What do you do for work?",
      isComplete: false,
      nextQuestion: "What do you do for work?",
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("What should I call you?");

    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Bradley" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/answer axel's question/i), {
      key: "Enter",
    });

    await waitFor(() => {
      expect(postOnboardingMessage).toHaveBeenCalledWith("Bradley");
    });
    expect(screen.getByText("What should I call you?")).toBeDefined();
    expect(screen.getByText("Bradley")).toBeDefined();
    expect(await screen.findByText("What do you do for work?")).toBeDefined();
  });

  it("updates nextQuestion after sending message (fixes stale banner bug)", async () => {
    // Initial state: question is "What should I call you?"
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["role"],
        collectedAnswers: {},
        completedAt: null,
        lastMessageAt: null,
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T10:03:30.000Z",
        },
      ],
      nextQuestion: "What should I call you?",
    });

    // After sending "Bradley", backend returns next question as "What do you do for work?"
    vi.mocked(postOnboardingMessage).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:05:00.000Z",
      },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T10:04:00.000Z",
        },
        {
          id: "m2",
          role: "user",
          content: "Bradley",
          createdAt: "2026-03-11T10:04:30.000Z",
        },
        {
          id: "m3",
          role: "assistant",
          content: "What do you do for work?",
          createdAt: "2026-03-11T10:05:00.000Z",
        },
      ],
      assistantResponse: "What do you do for work?",
      isComplete: false,
      nextQuestion: "What do you do for work?",
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    // Initial: banner shows "What should I call you?"
    expect(await screen.findByText("What should I call you?")).toBeDefined();

    // Send response
    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Bradley" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/answer axel's question/i), {
      key: "Enter",
    });

    // After response: new banner should show "What do you do for work?"
    // and old banner "What should I call you?" should NOT be duplicated
    await waitFor(() => {
      expect(screen.getAllByText("What should I call you?").length).toBe(1);
    });
    expect(await screen.findByText("What do you do for work?")).toBeDefined();
  });

  it("does not show stale banner when assistant wraps question with greeting", async () => {
    // Initial state
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["role"],
        collectedAnswers: {},
        completedAt: null,
        lastMessageAt: null,
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T10:03:30.000Z",
        },
      ],
      nextQuestion: "What should I call you?",
    });

    // After sending "Bradley", assistant response wraps the question with greeting
    vi.mocked(postOnboardingMessage).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:05:00.000Z",
      },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "What should I call you?",
          createdAt: "2026-03-11T10:04:00.000Z",
        },
        {
          id: "m2",
          role: "user",
          content: "Bradley",
          createdAt: "2026-03-11T10:04:30.000Z",
        },
        {
          id: "m3",
          role: "assistant",
          content:
            "Thanks Bradley! Your next question is: What do you do for work?",
          createdAt: "2026-03-11T10:05:00.000Z",
        },
      ],
      assistantResponse:
        "Thanks Bradley! Your next question is: What do you do for work?",
      isComplete: false,
      nextQuestion: "What do you do for work?",
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    // Initial: banner shows "What should I call you?"
    expect(await screen.findByText("What should I call you?")).toBeDefined();

    // Send response
    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Bradley" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/answer axel's question/i), {
      key: "Enter",
    });

    // After response: the new question appears in transcript (not banner)
    // Banner is suppressed because transcript already contains the question
    // Use waitFor to wait for state update to complete
    await waitFor(() => {
      expect(screen.getAllByText("What should I call you?").length).toBe(1);
    });
    // Use regex to match the question which is wrapped in greeting text
    expect(await screen.findByText(/What do you do for work\?/)).toBeDefined();

    // Verify there's no duplicate banner (only one occurrence of the question)
    const allQuestions = screen.getAllByText(/what do you do for work?/i);
    expect(allQuestions.length).toBe(1);
  });

  it("does not show duplicate banner when transcript has greeting-wrapped question with different intro", async () => {
    // This is the bug reported by Bradley:
    // - API returns assistant message: "Hey there! I've just been set up for you... what should I call you?"
    // - nextQuestion: "Before I can be useful, what should I call you?"
    // - UI was showing both the transcript AND a separate banner (duplicate)
    // The fix extracts the core question and checks if it appears in transcript
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["name"],
        collectedAnswers: {},
        completedAt: null,
        lastMessageAt: null,
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content:
            "Hey there! I've just been set up for you... what should I call you?",
          createdAt: "2026-03-11T10:03:30.000Z",
        },
      ],
      // nextQuestion has different introductory phrase but same core question
      nextQuestion: "Before I can be useful, what should I call you?",
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    // Transcript shows the greeting + question
    expect(
      await screen.findByText(
        "Hey there! I've just been set up for you... what should I call you?",
      ),
    ).toBeDefined();

    // Banner should NOT show because the core question is already in transcript
    // If bug existed, we'd see "Before I can be useful, what should I call you?" twice
    const nextQuestionBanners = screen.queryAllByText((_content, element) => {
      return (
        element?.textContent ===
          "Before I can be useful, what should I call you?" &&
        element.closest(".bg-surface-raised") !== null
      );
    });
    expect(nextQuestionBanners.length).toBe(0);

    // Verify the core question appears in transcript (not banner)
    const allQuestionTexts = screen.getAllByText(/what should i call you?/i);
    expect(allQuestionTexts.length).toBe(1);
  });

  it("handles initial completed onboarding state by switching to live mode", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "completed",
        outstandingQuestions: [],
        collectedAnswers: {},
        completedAt: "2026-03-11T10:10:00.000Z",
        lastMessageAt: "2026-03-11T10:10:00.000Z",
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: null,
    });

    // Mock the POST /users/onboarding/complete endpoint
    onboardingCompletePostMock.mockResolvedValue({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    // Should complete onboarding and switch to live mode instead of navigating
    await waitFor(() => {
      expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
      expect(refreshOnboardingStatus).toHaveBeenCalled();
      expect(onboardingCompletePostMock).not.toHaveBeenCalled();
      // No longer navigating to /dashboard/office
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it("shows onboarding load error when state fetch fails", async () => {
    vi.mocked(getOnboardingState).mockRejectedValue(new Error("State failed"));

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByText("State failed")).toBeDefined();
  });

  it("shows generic error message when load fails with non-Error object", async () => {
    vi.mocked(getOnboardingState).mockRejectedValue("string error");

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Failed to load state")).toBeDefined();
  });

  it("renders empty transcript when backend has no messages and no next question", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["name"],
        collectedAnswers: {},
        completedAt: null,
        lastMessageAt: null,
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: null,
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Onboarding mode")).toBeDefined();
    expect(screen.queryByText("What should I call you?")).toBeNull();
  });

  it("completes onboarding and switches to live mode when backend marks onboarding complete", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: "Which channels do you want?",
    });

    vi.mocked(postOnboardingMessage).mockResolvedValue({
      state: {
        id: "state-1",
        status: "completed",
        outstandingQuestions: [],
        collectedAnswers: {
          name: "Bradley",
          role: "Founder",
          channels: "Telegram",
        },
        completedAt: "2026-03-11T10:10:00.000Z",
        lastMessageAt: "2026-03-11T10:10:00.000Z",
      },
      messages: [
        {
          id: "m1",
          role: "assistant",
          content: "All set. You're onboarded.",
          createdAt: "2026-03-11T10:10:00.000Z",
        },
      ],
      assistantResponse: "All set. You're onboarded.",
      isComplete: true,
      nextQuestion: null,
    });

    // Mock the POST /users/onboarding/complete endpoint
    onboardingCompletePostMock.mockResolvedValue({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("Which channels do you want?");

    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
      expect(refreshOnboardingStatus).toHaveBeenCalled();
      // No longer navigating to /dashboard/office - stays in chat
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it("handles 409 completed-state conflict by switching to live mode", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: "Which channels do you want?",
    });

    vi.mocked(postOnboardingMessage).mockRejectedValue(
      new OnboardingAlreadyCompleteError(),
    );

    // Mock the POST /users/onboarding/complete endpoint
    onboardingCompletePostMock.mockResolvedValue({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("Which channels do you want?");

    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
      expect(refreshOnboardingStatus).toHaveBeenCalled();
      // No longer navigating to /dashboard/office - stays in chat
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  it("falls back to default send error message for non-Error failures", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: "Which channels do you want?",
    });

    vi.mocked(postOnboardingMessage).mockRejectedValue("unexpected failure");

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("Which channels do you want?");

    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByText("Failed to send message")).toBeDefined();
  });

  it("does not send message when input is empty", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: "Which channels do you want?",
    });

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("Which channels do you want?");

    // Try to send with empty input
    fireEvent.click(screen.getByRole("button"));

    // postOnboardingMessage should NOT have been called
    expect(postOnboardingMessage).not.toHaveBeenCalled();
  });

  it("does not send message when already sending", async () => {
    vi.mocked(getOnboardingState).mockResolvedValue({
      state: {
        id: "state-1",
        status: "in_progress",
        outstandingQuestions: ["channels"],
        collectedAnswers: { name: "Bradley", role: "Founder" },
        completedAt: null,
        lastMessageAt: "2026-03-11T10:00:00.000Z",
      },
      messages: [
        {
          id: "m0",
          role: "assistant",
          content: "Which channels do you want?",
          createdAt: "2026-03-11T10:00:00.000Z",
        },
      ],
      nextQuestion: "Which channels do you want?",
    });

    // Make postOnboardingMessage hang (never resolve) to simulate isSending state
    let resolvePostMessage: (value: unknown) => void;
    vi.mocked(postOnboardingMessage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePostMessage = resolve as (value: unknown) => void;
        }),
    );

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("Which channels do you want?");

    // Start first message
    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    // Now try to send another message while first is still pending
    fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
      target: { value: "Email" },
    });
    fireEvent.click(screen.getByRole("button"));

    // postOnboardingMessage should only have been called once
    expect(postOnboardingMessage).toHaveBeenCalledTimes(1);

    // Resolve the pending promise - wrap in act to fix React warnings
    await act(async () => {
      resolvePostMessage!({
        state: {
          id: "state-1",
          status: "completed",
          outstandingQuestions: [],
          collectedAnswers: {
            name: "Bradley",
            role: "Founder",
            channels: "Telegram",
          },
          completedAt: "2026-03-11T10:10:00.000Z",
          lastMessageAt: "2026-03-11T10:10:00.000Z",
        },
        messages: [],
        assistantResponse: "Done",
        isComplete: true,
      });
    });
  });

  describe("Provisioning mode", () => {
    it("shows provisioning state when agent status is provisioning on load", async () => {
      // Always return provisioning so the poll reschedules (not a concern for this test)
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "provisioning",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      expect(await screen.findByText("Setting up")).toBeDefined();
      expect(
        await screen.findByText(/your agent is being set up/i),
      ).toBeDefined();
      expect(
        screen.getByPlaceholderText(/setting up your agent/i),
      ).toBeDefined();
    });

    it("disables input and send button in provisioning mode", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "provisioning",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      await screen.findByText("Setting up");

      const input = screen.getByPlaceholderText(/setting up your agent/i);
      const button = screen.getByRole("button");

      expect((input as HTMLInputElement).disabled).toBe(true);
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it("polls agent status and switches to live mode when agent becomes active", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // Call 1 (loadState): provisioning
        // Call 2 (immediate poll): provisioning (so "Setting up" renders stably)
        // Call 3 (poll after timer): active
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "active" });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        // Should enter provisioning mode
        await screen.findByText("Setting up");

        // Advance timer to trigger the poll that returns active
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        // Should switch to live mode after poll
        await waitFor(() => {
          expect(screen.queryByText("Setting up")).toBeNull();
          expect(screen.getByText("Chat")).toBeDefined();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("continues polling when agent status remains provisioning", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // Call 1 (loadState): provisioning
        // Call 2 (immediate poll): provisioning (renders "Setting up" stably)
        // Call 3 (poll after first timer): provisioning (still waiting)
        // Call 4 (poll after second timer): active
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "active" });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        await screen.findByText("Setting up");

        // First timer advance: still provisioning
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect(screen.getByText("Setting up")).toBeDefined();
        });

        // Second timer advance: active
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect(screen.getByText("Chat")).toBeDefined();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("continues polling when poll throws an error", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // Call 1 (loadState): provisioning
        // Call 2 (immediate poll): provisioning (renders "Setting up" stably)
        // Call 3 (poll after timer): throws (reschedules)
        // Call 4 (poll after second timer): active
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockRejectedValueOnce(new Error("Network error"))
          .mockResolvedValueOnce({ success: true, status: "active" });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        await screen.findByText("Setting up");

        // First timer: poll throws, reschedules
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        // Should still be in provisioning mode
        await waitFor(() => {
          expect(screen.getByText("Setting up")).toBeDefined();
        });

        // Second timer: poll returns active
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect(screen.getByText("Chat")).toBeDefined();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("does not reschedule timer or update state after unmount during in-flight poll", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        let resolveInFlightPoll!: (value: {
          success: boolean;
          status: string;
        }) => void;

        // Call 1 (loadState): provisioning → triggers startProvisioningPoll
        // Call 2 (immediate poll): hangs until we manually resolve it
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockImplementationOnce(
            () =>
              new Promise((resolve) => {
                resolveInFlightPoll = resolve as (value: {
                  success: boolean;
                  status: string;
                }) => void;
              }),
          );

        const { unmount } = render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        // Wait for provisioning mode to be rendered (Call 1 resolved, Call 2 in-flight)
        await screen.findByText("Setting up");

        // Unmount while Call 2 is still in-flight
        unmount();

        // Resolve the in-flight call as "provisioning" — without the mounted guard
        // this would schedule a new setTimeout on an unmounted component
        await act(async () => {
          resolveInFlightPoll({ success: true, status: "provisioning" });
        });

        // Advance well past the poll interval — a leaked timer would trigger Call 3
        await act(async () => {
          vi.advanceTimersByTime(10000);
        });

        // Only the two calls before unmount should have occurred; no Call 3
        expect(getAgentStatus).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("cancels the prior poll chain when startProvisioningPoll is called a second time (generation guard)", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // React StrictMode double-invokes effects in development, causing
        // startProvisioningPoll to be called twice. Without the generation
        // counter the first chain survives effect cleanup and polls concurrently
        // with the second chain.
        //
        // Expected call sequence WITH the fix:
        //   Call 1: loadState #1  → provisioning → chain gen=A starts
        //   StrictMode cleanup   → gen bumped, chain A invalidated
        //   Call 2: loadState #2  → provisioning → chain gen=B starts
        //   Call 3: chain A immediate poll → gen mismatch → STOP (no reschedule)
        //   Call 4: chain B immediate poll → provisioning → timer scheduled
        //   timer fires → Call 5: active → live mode
        //
        // Without the fix chain A would not stop, leaving a leaked timer that
        // fires a 6th call (no mock value → undefined/error, breaking the test).
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" }) // loadState #1
          .mockResolvedValueOnce({ success: true, status: "provisioning" }) // loadState #2
          .mockResolvedValueOnce({ success: true, status: "provisioning" }) // chain A (cancelled)
          .mockResolvedValueOnce({ success: true, status: "provisioning" }) // chain B immediate
          .mockResolvedValueOnce({ success: true, status: "active" }); //      chain B timer

        render(
          <React.StrictMode>
            <MemoryRouter>
              <Chat />
            </MemoryRouter>
          </React.StrictMode>,
        );

        await screen.findByText("Setting up");

        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect(screen.getByText("Chat")).toBeDefined();
        });

        // Drain any remaining timers. Without the generation guard a leaked
        // timer from chain A would fire here and attempt a 6th call.
        await act(async () => {
          vi.advanceTimersByTime(10_000);
        });

        // Exactly 5 calls. A 6th would indicate a duplicate chain survived.
        expect(getAgentStatus).toHaveBeenCalledTimes(5);
      } finally {
        vi.useRealTimers();
      }
    });

    it("redirects to /subscribe and stops polling when subscription_required is returned during poll", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // Call 1 (loadState): provisioning
        // Call 2 (immediate poll): subscription_required → should redirect and stop
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({
            success: true,
            status: "subscription_required",
          });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        await screen.findByText("Setting up");

        await waitFor(() => {
          expect(navigateMock).toHaveBeenCalledWith("/subscribe");
        });

        // Advance well past the poll interval to confirm no further polling
        await act(async () => {
          vi.advanceTimersByTime(10000);
        });

        // Only the two calls before the terminal status should have occurred
        expect(getAgentStatus).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("enters provisioning mode after completing onboarding when agent is provisioning", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // Call 1 (loadState): not_found (no agent yet)
        // Call 2 (handleCompleteOnboarding check): provisioning
        // Call 3 (immediate poll): provisioning (renders "Setting up" stably)
        // Call 4 (poll after timer): active
        vi.mocked(getAgentStatus)
          .mockRejectedValueOnce(new Error("not found"))
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "active" });

        vi.mocked(getOnboardingState).mockResolvedValue({
          state: {
            id: "state-1",
            status: "in_progress",
            outstandingQuestions: ["channels"],
            collectedAnswers: { name: "Bradley", role: "Founder" },
            completedAt: null,
            lastMessageAt: "2026-03-11T10:00:00.000Z",
          },
          messages: [
            {
              id: "m0",
              role: "assistant",
              content: "Which channels do you want?",
              createdAt: "2026-03-11T10:00:00.000Z",
            },
          ],
          nextQuestion: "Which channels do you want?",
        });

        vi.mocked(postOnboardingMessage).mockResolvedValue({
          state: {
            id: "state-1",
            status: "completed",
            outstandingQuestions: [],
            collectedAnswers: {
              name: "Bradley",
              role: "Founder",
              channels: "Telegram",
            },
            completedAt: "2026-03-11T10:10:00.000Z",
            lastMessageAt: "2026-03-11T10:10:00.000Z",
          },
          messages: [
            {
              id: "m1",
              role: "assistant",
              content: "All set. You're onboarded.",
              createdAt: "2026-03-11T10:10:00.000Z",
            },
          ],
          assistantResponse: "All set. You're onboarded.",
          isComplete: true,
          nextQuestion: null,
        });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        await screen.findByText("Which channels do you want?");

        fireEvent.change(
          screen.getByPlaceholderText(/answer axel's question/i),
          {
            target: { value: "Telegram" },
          },
        );
        fireEvent.click(screen.getByRole("button"));

        // Should enter provisioning mode after completing onboarding
        await waitFor(() => {
          expect(screen.getByText("Setting up")).toBeDefined();
        });

        // Advance timer to trigger the poll (becomes active)
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        await waitFor(() => {
          expect(screen.getByText("Chat")).toBeDefined();
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows failed state and stops polling when agent status is failed on load", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        vi.mocked(getAgentStatus).mockResolvedValue({
          success: true,
          status: "failed",
        });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        expect(await screen.findByText("Setup failed")).toBeDefined();
        expect(await screen.findByText(/agent setup failed/i)).toBeDefined();

        // Advance well past poll interval — no poll should be running
        await act(async () => {
          vi.advanceTimersByTime(10000);
        });

        // Only the single loadState call — no poll chain started
        expect(getAgentStatus).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it("disables input and send button in failed mode", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "failed",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      await screen.findByText("Setup failed");

      const input = screen.getByRole("textbox");
      const button = screen.getByRole("button");

      expect((input as HTMLInputElement).disabled).toBe(true);
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });

    it("stops polling and shows error when poll returns failed during provisioning", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      try {
        // Call 1 (loadState): provisioning → start polling
        // Call 2 (immediate poll): provisioning (so "Setting up" renders stably)
        // Call 3 (poll after timer): failed → stop, set error
        vi.mocked(getAgentStatus)
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "provisioning" })
          .mockResolvedValueOnce({ success: true, status: "failed" });

        render(
          <MemoryRouter>
            <Chat />
          </MemoryRouter>,
        );

        // Should enter provisioning mode
        await screen.findByText("Setting up");

        // Advance timer to trigger the poll that returns failed
        await act(async () => {
          vi.advanceTimersByTime(3000);
        });

        // Should switch to failed mode and display error
        await waitFor(() => {
          expect(screen.getByText("Setup failed")).toBeDefined();
        });

        expect(await screen.findByText(/agent setup failed/i)).toBeDefined();

        // Advance well past the poll interval — no further poll should fire
        await act(async () => {
          vi.advanceTimersByTime(10000);
        });

        // Exactly 3 calls: loadState + immediate poll + one timed poll iteration
        expect(getAgentStatus).toHaveBeenCalledTimes(3);
      } finally {
        vi.useRealTimers();
      }
    });

    it("falls back to live mode when agent status check fails after completing onboarding", async () => {
      // Initial: not_found
      vi.mocked(getAgentStatus)
        .mockRejectedValueOnce(new Error("not found"))
        // After completeOnboarding: throws
        .mockRejectedValueOnce(new Error("status check failed"));

      vi.mocked(getOnboardingState).mockResolvedValue({
        state: {
          id: "state-1",
          status: "in_progress",
          outstandingQuestions: ["channels"],
          collectedAnswers: { name: "Bradley", role: "Founder" },
          completedAt: null,
          lastMessageAt: "2026-03-11T10:00:00.000Z",
        },
        messages: [
          {
            id: "m0",
            role: "assistant",
            content: "Which channels do you want?",
            createdAt: "2026-03-11T10:00:00.000Z",
          },
        ],
        nextQuestion: "Which channels do you want?",
      });

      vi.mocked(postOnboardingMessage).mockResolvedValue({
        state: {
          id: "state-1",
          status: "completed",
          outstandingQuestions: [],
          collectedAnswers: {
            name: "Bradley",
            role: "Founder",
            channels: "Telegram",
          },
          completedAt: "2026-03-11T10:10:00.000Z",
          lastMessageAt: "2026-03-11T10:10:00.000Z",
        },
        messages: [],
        assistantResponse: "All set.",
        isComplete: true,
        nextQuestion: null,
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      await screen.findByText("Which channels do you want?");

      fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
        target: { value: "Telegram" },
      });
      fireEvent.click(screen.getByRole("button"));

      // Should fall back to live mode when status check fails
      await waitFor(() => {
        expect(screen.getByText("Chat")).toBeDefined();
      });
    });
  });

  describe("Live chat mode", () => {
    it("switches to live mode when agent is active", async () => {
      // Mock agent status as active
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      // Should show "Chat" label (not "Onboarding mode")
      expect(await screen.findByText("Chat")).toBeDefined();
      // Should show live chat placeholder
      expect(screen.getByPlaceholderText(/ask axel to help/i)).toBeDefined();
    });

    it("sends message in live mode and shows assistant response", async () => {
      // Mock agent status as active
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      // Mock postChatMessage to return a response
      vi.mocked(postChatMessage).mockResolvedValue({
        success: true,
        response: "Hello! I'm Axel, how can I help?",
        messageId: "assistant-msg-1",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      // Wait for live mode
      expect(await screen.findByText("Chat")).toBeDefined();

      // Type and send a message
      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button"));

      // Should show user's message
      await waitFor(() => {
        expect(screen.getByText("Hello")).toBeDefined();
      });

      // Should show assistant response
      await waitFor(() => {
        expect(
          screen.getByText("Hello! I'm Axel, how can I help?"),
        ).toBeDefined();
      });

      expect(postChatMessage).toHaveBeenCalledWith("Hello");
    });

    it("does not send message in live mode when input is empty", async () => {
      // Mock agent status as active
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      // Wait for live mode
      expect(await screen.findByText("Chat")).toBeDefined();

      // Try to send with empty input
      fireEvent.click(screen.getByRole("button"));

      // postChatMessage should NOT have been called
      expect(postChatMessage).not.toHaveBeenCalled();
    });

    it("does not send message in live mode when already sending", async () => {
      // Mock agent status as active
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      // Make postChatMessage hang
      let resolvePostMessage: (value: unknown) => void;
      vi.mocked(postChatMessage).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePostMessage = resolve as (value: unknown) => void;
          }),
      );

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      // Wait for live mode
      expect(await screen.findByText("Chat")).toBeDefined();

      // Start first message
      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button"));

      // Try to send another message while first is pending
      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Another message" },
      });
      fireEvent.click(screen.getByRole("button"));

      // postChatMessage should only have been called once
      expect(postChatMessage).toHaveBeenCalledTimes(1);

      // Resolve the pending promise
      await act(async () => {
        resolvePostMessage!({
          success: true,
          response: "Hi there!",
          messageId: "msg-1",
        });
      });
    });

    it("shows error in live mode when send fails", async () => {
      // Mock agent status as active
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      // Mock postChatMessage to throw
      vi.mocked(postChatMessage).mockRejectedValue(new Error("Failed to send"));

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      // Wait for live mode
      expect(await screen.findByText("Chat")).toBeDefined();

      // Type and try to send a message
      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button"));

      // Should show user's message (optimistic)
      await waitFor(() => {
        expect(screen.getByText("Hello")).toBeDefined();
      });

      // Should show error
      expect(await screen.findByText("Failed to send")).toBeDefined();
    });

    it("falls back to default error message for non-Error failures in live mode", async () => {
      // Mock agent status as active
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      // Mock postChatMessage to throw a non-Error
      vi.mocked(postChatMessage).mockRejectedValue("string error");

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      // Wait for live mode
      expect(await screen.findByText("Chat")).toBeDefined();

      // Type and try to send a message
      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button"));

      // Should show generic error
      expect(await screen.findByText("Failed to send message")).toBeDefined();
    });

    it("redirects to /subscribe when postChatMessage returns 402", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      vi.mocked(postChatMessage).mockRejectedValue(
        new SubscriptionRequiredError(),
      );

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      expect(await screen.findByText("Chat")).toBeDefined();

      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/subscribe");
      });

      // Should not show an error banner
      expect(screen.queryByText("subscription_required")).toBeNull();
    });
  });

  describe("subscription_required redirect", () => {
    it("redirects to /subscribe when agent status is subscription_required", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "subscription_required",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/subscribe");
      });
    });
  });

  describe("subscription_required redirect", () => {
    it("redirects to /subscribe on load when agent status is subscription_required", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "subscription_required",
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/subscribe");
      });
    });

    it("redirects to /subscribe when getAgentStatus returns subscription_required after completing onboarding", async () => {
      // Call 1 (loadState): not_found — fall through to onboarding
      // Call 2 (handleCompleteOnboarding status check): subscription_required → redirect
      vi.mocked(getAgentStatus)
        .mockRejectedValueOnce(new Error("not found"))
        .mockResolvedValueOnce({
          success: true,
          status: "subscription_required",
        });

      vi.mocked(getOnboardingState).mockResolvedValue({
        state: {
          id: "state-1",
          status: "in_progress",
          outstandingQuestions: ["channels"],
          collectedAnswers: { name: "Bradley", role: "Founder" },
          completedAt: null,
          lastMessageAt: "2026-03-11T10:00:00.000Z",
        },
        messages: [
          {
            id: "m0",
            role: "assistant",
            content: "Which channels do you want?",
            createdAt: "2026-03-11T10:00:00.000Z",
          },
        ],
        nextQuestion: "Which channels do you want?",
      });

      vi.mocked(postOnboardingMessage).mockResolvedValue({
        state: {
          id: "state-1",
          status: "completed",
          outstandingQuestions: [],
          collectedAnswers: {
            name: "Bradley",
            role: "Founder",
            channels: "Telegram",
          },
          completedAt: "2026-03-11T10:10:00.000Z",
          lastMessageAt: "2026-03-11T10:10:00.000Z",
        },
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "All set. You're onboarded.",
            createdAt: "2026-03-11T10:10:00.000Z",
          },
        ],
        assistantResponse: "All set. You're onboarded.",
        isComplete: true,
        nextQuestion: null,
      });

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      await screen.findByText("Which channels do you want?");

      fireEvent.change(screen.getByPlaceholderText(/answer axel's question/i), {
        target: { value: "Telegram" },
      });
      fireEvent.click(screen.getByRole("button"));

      // Should redirect to /subscribe instead of switching to live mode
      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/subscribe");
      });

      // Should NOT enter live mode
      expect(screen.queryByText("Chat")).toBeNull();
    });

    it("redirects to /subscribe when postChatMessage returns 402", async () => {
      vi.mocked(getAgentStatus).mockResolvedValue({
        success: true,
        status: "active",
      });

      vi.mocked(postChatMessage).mockRejectedValue(
        new SubscriptionRequiredError(),
      );

      render(
        <MemoryRouter>
          <Chat />
        </MemoryRouter>,
      );

      expect(await screen.findByText("Chat")).toBeDefined();

      fireEvent.change(screen.getByPlaceholderText(/ask axel to help/i), {
        target: { value: "Hello" },
      });
      fireEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(navigateMock).toHaveBeenCalledWith("/subscribe");
      });

      // Should not show an error banner for subscription errors
      expect(screen.queryByText("subscription_required")).toBeNull();
    });
  });
});
