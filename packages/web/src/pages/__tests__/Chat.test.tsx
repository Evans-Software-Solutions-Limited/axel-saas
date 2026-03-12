import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Chat } from "../Chat";
import {
  getOnboardingState,
  postOnboardingMessage,
  OnboardingAlreadyCompleteError,
} from "../chat/onboardingApi";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

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

vi.mock("../chat/onboardingApi", () => ({
  getOnboardingState: vi.fn(),
  postOnboardingMessage: vi.fn(),
  OnboardingAlreadyCompleteError: class OnboardingAlreadyCompleteError extends Error {},
}));

describe("Chat onboarding integration", () => {
  const setOnboardingCompleted = vi.fn();
  const refreshOnboardingStatus = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(screen.getByPlaceholderText(/tell axel what to do/i)).toBeDefined();
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

    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Bradley" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/tell axel what to do/i), {
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
    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Bradley" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/tell axel what to do/i), {
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
    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Bradley" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/tell axel what to do/i), {
      key: "Enter",
    });

    // After response: the old banner should be replaced with new one
    // and NOT duplicated - the banner should now show "What do you do for work?"
    await waitFor(() => {
      expect(screen.queryByText("Next question")).not.toBeNull();
    });
    expect(await screen.findByText("What do you do for work?")).toBeDefined();
  });

  it("handles initial completed onboarding state by unlocking and redirecting", async () => {
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

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
      expect(refreshOnboardingStatus).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/office", {
        replace: true,
      });
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

    expect(
      await screen.findByText("Failed to load onboarding state"),
    ).toBeDefined();
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

  it("unlocks app and redirects when backend marks onboarding complete", async () => {
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

    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
      expect(refreshOnboardingStatus).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/office", {
        replace: true,
      });
    });
  });

  it("handles 409 completed-state conflict by unlocking and redirecting", async () => {
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

    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    await screen.findByText("Which channels do you want?");

    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(setOnboardingCompleted).toHaveBeenCalledWith(true);
      expect(refreshOnboardingStatus).toHaveBeenCalled();
      expect(navigateMock).toHaveBeenCalledWith("/dashboard/office", {
        replace: true,
      });
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

    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    expect(
      await screen.findByText("Failed to send onboarding message"),
    ).toBeDefined();
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
    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Telegram" },
    });
    fireEvent.click(screen.getByRole("button"));

    // Now try to send another message while first is still pending
    fireEvent.change(screen.getByPlaceholderText(/tell axel what to do/i), {
      target: { value: "Email" },
    });
    fireEvent.click(screen.getByRole("button"));

    // postOnboardingMessage should only have been called once
    expect(postOnboardingMessage).toHaveBeenCalledTimes(1);

    // Resolve the pending promise
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
