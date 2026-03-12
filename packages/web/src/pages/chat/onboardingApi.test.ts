import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOnboardingState,
  OnboardingAlreadyCompleteError,
  postOnboardingMessage,
} from "./onboardingApi";

const { stateGetMock, messagePostMock } = vi.hoisted(() => ({
  stateGetMock: vi.fn(),
  messagePostMock: vi.fn(),
}));

vi.mock("@/lib/eden", () => ({
  api: {
    core: {
      users: {
        onboarding: {
          state: {
            get: stateGetMock,
          },
          message: {
            post: messagePostMock,
          },
        },
      },
    },
  },
}));

describe("onboardingApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns onboarding state when API responds with success payload", async () => {
    stateGetMock.mockResolvedValue({
      data: {
        success: true,
        state: {
          id: "state-1",
          status: "in_progress",
          outstandingQuestions: ["role"],
          collectedAnswers: { name: "Bradley" },
          completedAt: null,
          lastMessageAt: null,
        },
        messages: [],
        nextQuestion: "What do you do for work?",
      },
    });

    const result = await getOnboardingState();

    expect(result.state?.status).toBe("in_progress");
    expect(result.nextQuestion).toBe("What do you do for work?");
  });

  it("throws fetch error from response error message", async () => {
    stateGetMock.mockResolvedValue({
      data: undefined,
      error: {
        message: "Unauthorized",
      },
    });

    await expect(getOnboardingState()).rejects.toThrow("Unauthorized");
  });

  it("throws fetch error from nested error value payload", async () => {
    stateGetMock.mockResolvedValue({
      data: undefined,
      error: {
        value: {
          error: "Backend failed",
        },
      },
    });

    await expect(getOnboardingState()).rejects.toThrow("Backend failed");
  });

  it("returns post response when onboarding message succeeds", async () => {
    messagePostMock.mockResolvedValue({
      data: {
        success: true,
        state: {
          id: "state-1",
          status: "in_progress",
          outstandingQuestions: ["channels"],
          collectedAnswers: { name: "Bradley", role: "Founder" },
          completedAt: null,
          lastMessageAt: null,
        },
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "Which channels do you want?",
            createdAt: "2026-03-11T10:00:00.000Z",
          },
        ],
        assistantResponse: "Which channels do you want?",
        isComplete: false,
        nextQuestion: "Which channels do you want?",
      },
    });

    const result = await postOnboardingMessage("Founder");

    expect(result.isComplete).toBe(false);
    expect(result.messages[0]?.content).toContain("Which channels");
  });

  it("throws OnboardingAlreadyCompleteError when response status is 409", async () => {
    messagePostMock.mockResolvedValue({
      data: undefined,
      error: {
        status: 409,
      },
    });

    await expect(postOnboardingMessage("Telegram")).rejects.toBeInstanceOf(
      OnboardingAlreadyCompleteError,
    );
  });

  it("throws message error when response contains non-409 error", async () => {
    messagePostMock.mockResolvedValue({
      data: undefined,
      error: {
        message: "Bad request",
        status: 400,
      },
    });

    await expect(postOnboardingMessage("Telegram")).rejects.toThrow(
      "Bad request",
    );
  });

  it("maps thrown 409 exceptions to OnboardingAlreadyCompleteError", async () => {
    messagePostMock.mockRejectedValue({ status: 409 });

    await expect(postOnboardingMessage("Telegram")).rejects.toBeInstanceOf(
      OnboardingAlreadyCompleteError,
    );
  });

  it("maps thrown nested 409 exceptions to OnboardingAlreadyCompleteError", async () => {
    messagePostMock.mockRejectedValue({ error: { status: 409 } });

    await expect(postOnboardingMessage("Telegram")).rejects.toBeInstanceOf(
      OnboardingAlreadyCompleteError,
    );
  });

  it("rethrows unknown exceptions for non-409 thrown errors", async () => {
    messagePostMock.mockRejectedValue(new Error("Network down"));

    await expect(postOnboardingMessage("Telegram")).rejects.toThrow(
      "Network down",
    );
  });

  it("throws when getOnboardingState returns success but missing required keys", async () => {
    stateGetMock.mockResolvedValue({
      data: {
        success: true,
        // missing state, messages, nextQuestion
      },
    });

    await expect(getOnboardingState()).rejects.toThrow(
      "Failed to fetch onboarding state",
    );
  });

  it("throws when postOnboardingMessage returns success but missing required keys", async () => {
    messagePostMock.mockResolvedValue({
      data: {
        success: true,
        // missing state, messages, assistantResponse, isComplete
      },
    });

    await expect(postOnboardingMessage("test")).rejects.toThrow(
      "Failed to send onboarding message",
    );
  });

  it("throws generic error when caught error has no status code", async () => {
    messagePostMock.mockRejectedValue("string error not an object");

    await expect(postOnboardingMessage("test")).rejects.toThrow();
  });
});
