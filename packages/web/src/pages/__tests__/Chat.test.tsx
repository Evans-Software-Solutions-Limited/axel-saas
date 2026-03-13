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
import { getAgentStatus, postChatMessage } from "../chat/chatApi";
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
  });
});
