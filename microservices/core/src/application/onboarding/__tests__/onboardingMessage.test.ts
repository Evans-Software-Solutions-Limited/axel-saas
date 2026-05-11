/**
 * Tests for POST /users/onboarding/message
 *
 * Key contract tested here: a duplicate message sent in the window between
 * processMessage returning isComplete=true (which stamps
 * onboardingState.status="completed") and /users/onboarding/complete setting
 * users.onboardingCompleted=true must return 409, not 500.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetUserBySupabaseId,
  mockGetState,
  mockProcessMessage,
  mockGetOrCreateState,
  mockEnsureTranscript,
  mockGetStateWithMessages,
} = vi.hoisted(() => ({
  mockGetUserBySupabaseId: vi.fn(),
  mockGetState: vi.fn(),
  mockProcessMessage: vi.fn(),
  mockGetOrCreateState: vi.fn(),
  mockEnsureTranscript: vi.fn(),
  mockGetStateWithMessages: vi.fn(),
}));

vi.mock("@axel-saas/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("../../repositories/userRepository", () => ({
  userRepository: {
    getUserBySupabaseId: mockGetUserBySupabaseId,
  },
}));

vi.mock("../onboardingRepository", () => ({
  onboardingRepository: {
    getState: mockGetState,
    getStateWithMessages: mockGetStateWithMessages,
    getOrCreateState: mockGetOrCreateState,
    ensureTranscript: mockEnsureTranscript,
    processMessage: mockProcessMessage,
    getNextQuestion: vi.fn(() => null),
  },
  QUESTION_PROMPTS: {
    name: "What should I call you?",
  },
}));

vi.mock("../../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn(() => ({})),
}));

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn(() => ({})),
}));

vi.mock("../../workspace/workspaceGenerator", () => ({
  generateWorkspaceFiles: vi.fn(),
  writeWorkspaceFiles: vi.fn(),
}));

vi.mock("../../provisioning/provisioningService", () => ({
  resolveWorkspacePath: vi.fn(),
}));

vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: vi.fn(() => ({ sub: "supabase-123" })),
  requireAuth: vi.fn(), // no-op: let every request through
  getUser: vi.fn(() => ({ sub: "supabase-123" })),
}));

import { onboardingHandler } from "../onboardingHandler";

function makeMessageRequest(message = "hello"): Request {
  return new Request("http://localhost/users/onboarding/message", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
}

const MOCK_USER = {
  id: "db-user-123",
  supabaseUserId: "supabase-123",
  email: "test@example.com",
  fullName: "Test User",
  onboardingCompleted: false,
  notificationPreferences: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_STATE_IN_PROGRESS = {
  id: "state-1",
  userId: "db-user-123",
  status: "in_progress" as const,
  collectedAnswers: { name: "Alice" },
  requiredFieldsCompleted: { name: true, helpWith: false, channels: false },
  outstandingQuestions: ["helpWith", "channels"],
  completedAt: null,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_STATE_COMPLETED = {
  ...MOCK_STATE_IN_PROGRESS,
  status: "completed" as const,
  outstandingQuestions: [] as string[],
  completedAt: new Date(),
};

describe("POST /users/onboarding/message", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserBySupabaseId.mockResolvedValue(MOCK_USER);
    mockGetState.mockResolvedValue(MOCK_STATE_IN_PROGRESS);
  });

  describe("duplicate message in the window between final answer and /complete", () => {
    it("returns 409 when onboardingState.status is completed but users.onboardingCompleted is still false", async () => {
      // Simulate the race window: users flag not yet flipped, but state row is completed
      mockGetUserBySupabaseId.mockResolvedValue({
        ...MOCK_USER,
        onboardingCompleted: false,
      });
      mockGetState.mockResolvedValue(MOCK_STATE_COMPLETED);

      const res = await onboardingHandler.handle(makeMessageRequest());

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(String(body.error)).toMatch(/already completed/i);
    });

    it("does NOT call processMessage in the window — avoids the 500", async () => {
      mockGetUserBySupabaseId.mockResolvedValue({
        ...MOCK_USER,
        onboardingCompleted: false,
      });
      mockGetState.mockResolvedValue(MOCK_STATE_COMPLETED);

      await onboardingHandler.handle(makeMessageRequest());

      expect(mockProcessMessage).not.toHaveBeenCalled();
    });

    it("returns 409 (not 500) even when processMessage would throw for a completed state", async () => {
      // Verify that the old broken path (processMessage throwing → 500) no longer occurs
      mockGetUserBySupabaseId.mockResolvedValue({
        ...MOCK_USER,
        onboardingCompleted: false,
      });
      mockGetState.mockResolvedValue(MOCK_STATE_COMPLETED);
      // Wire processMessage to throw exactly what it would have thrown before the fix
      mockProcessMessage.mockRejectedValue(
        new Error(
          "Onboarding already completed for this user. No further messages can be added.",
        ),
      );

      const res = await onboardingHandler.handle(makeMessageRequest());

      // Must be 409, not 500 — the state check short-circuits before processMessage
      expect(res.status).toBe(409);
    });
  });

  describe("existing 409 path — users.onboardingCompleted already true", () => {
    it("returns 409 when users.onboardingCompleted is true", async () => {
      mockGetUserBySupabaseId.mockResolvedValue({
        ...MOCK_USER,
        onboardingCompleted: true,
      });

      const res = await onboardingHandler.handle(makeMessageRequest());

      expect(res.status).toBe(409);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
    });

    it("does NOT call getState when users.onboardingCompleted is already true (early exit)", async () => {
      mockGetUserBySupabaseId.mockResolvedValue({
        ...MOCK_USER,
        onboardingCompleted: true,
      });

      await onboardingHandler.handle(makeMessageRequest());

      // getState is only needed for the window check; it should not be reached
      // when the users flag is already set
      expect(mockGetState).not.toHaveBeenCalled();
    });
  });

  describe("happy path — message is processed normally", () => {
    it("returns 200 when user is in progress and state is not completed", async () => {
      mockGetState.mockResolvedValue(MOCK_STATE_IN_PROGRESS);
      mockProcessMessage.mockResolvedValue({
        state: MOCK_STATE_IN_PROGRESS,
        messages: [],
        assistantResponse: "What would you like me to help with?",
        isComplete: false,
        nextQuestion: "What would you like me to help with?",
      });

      const res = await onboardingHandler.handle(makeMessageRequest("Alice"));

      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    it("calls processMessage with the correct userId and message", async () => {
      mockGetState.mockResolvedValue(MOCK_STATE_IN_PROGRESS);
      mockProcessMessage.mockResolvedValue({
        state: MOCK_STATE_IN_PROGRESS,
        messages: [],
        assistantResponse: "Got it!",
        isComplete: false,
        nextQuestion: null,
      });

      await onboardingHandler.handle(makeMessageRequest("my answer"));

      expect(mockProcessMessage).toHaveBeenCalledWith(
        "db-user-123",
        "my answer",
      );
    });
  });

  describe("error handling", () => {
    it("returns 404 when user is not found", async () => {
      mockGetUserBySupabaseId.mockResolvedValue(null);

      const res = await onboardingHandler.handle(makeMessageRequest());

      expect(res.status).toBe(404);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
    });
  });
});
