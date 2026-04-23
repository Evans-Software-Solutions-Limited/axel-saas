/**
 * Tests for POST /users/onboarding/complete
 *
 * Key contract: users.onboardingCompleted is only set to true AFTER
 * workspace files are successfully written to disk. A failed write must
 * leave the user in the in-progress state so the frontend keeps them on
 * the onboarding flow rather than opening a workspace that doesn't exist.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted makes these available inside vi.mock factory closures
const {
  mockGetUserBySupabaseId,
  mockUpdateById,
  mockUpdateOnboardingAnswers,
  mockGetStateWithMessages,
  mockIsComplete,
  mockMarkCompleted,
  mockProvFindByUserId,
  mockProvCreate,
  mockUpdateProvisioned,
  mockSubFindByUserId,
  mockWriteWorkspaceFiles,
  mockGenerateWorkspaceFiles,
  mockResolveWorkspacePath,
} = vi.hoisted(() => ({
  mockGetUserBySupabaseId: vi.fn(),
  mockUpdateById: vi.fn(),
  mockUpdateOnboardingAnswers: vi.fn(),
  mockGetStateWithMessages: vi.fn(),
  mockIsComplete: vi.fn(),
  mockMarkCompleted: vi.fn(),
  mockProvFindByUserId: vi.fn(),
  mockProvCreate: vi.fn(),
  mockUpdateProvisioned: vi.fn(),
  mockSubFindByUserId: vi.fn(),
  mockWriteWorkspaceFiles: vi.fn(),
  mockGenerateWorkspaceFiles: vi.fn(),
  mockResolveWorkspacePath: vi.fn(),
}));

vi.mock("@axel-saas/db", () => ({ getDb: vi.fn(() => ({})) }));

vi.mock("../../repositories/userRepository", () => ({
  userRepository: {
    getUserBySupabaseId: mockGetUserBySupabaseId,
    updateById: mockUpdateById,
    updateOnboardingAnswers: mockUpdateOnboardingAnswers,
  },
}));

vi.mock("../onboardingRepository", () => ({
  onboardingRepository: {
    getStateWithMessages: mockGetStateWithMessages,
    isComplete: mockIsComplete,
    markCompleted: mockMarkCompleted,
    getOrCreateState: vi.fn(),
    ensureTranscript: vi.fn(),
    getNextQuestion: vi.fn(),
  },
  QUESTION_PROMPTS: {},
}));

vi.mock("../../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn(() => ({
    findByUserId: mockProvFindByUserId,
    create: mockProvCreate,
    updateProvisioned: mockUpdateProvisioned,
  })),
}));

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn(() => ({
    findByUserId: mockSubFindByUserId,
  })),
}));

vi.mock("../../workspace/workspaceGenerator", () => ({
  generateWorkspaceFiles: mockGenerateWorkspaceFiles,
  writeWorkspaceFiles: mockWriteWorkspaceFiles,
}));

vi.mock("../../provisioning/provisioningService", () => ({
  resolveWorkspacePath: mockResolveWorkspacePath,
}));

vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: vi.fn(() => ({ sub: "supabase-123" })),
  requireAuth: vi.fn(), // no-op: let every request through
  getUser: vi.fn(() => ({ sub: "supabase-123" })),
}));

// Import after all mocks are registered
import { onboardingHandler } from "../onboardingHandler";

function makeRequest(): Request {
  return new Request("http://localhost/users/onboarding/complete", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
  });
}

const MOCK_USER = {
  id: "db-user-123",
  supabaseUserId: "supabase-123",
  email: "test@example.com",
  fullName: "Test User",
  onboardingCompleted: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_STATE = {
  id: "state-1",
  userId: "db-user-123",
  status: "in_progress" as const,
  collectedAnswers: { name: "Alice", helpWith: "tasks", channels: "Slack" },
  requiredFieldsCompleted: { name: true, helpWith: true, channels: true },
  outstandingQuestions: [] as string[],
  completedAt: null,
  lastMessageAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_PROVISIONING = {
  id: "prov-1",
  userId: "db-user-123",
  status: "pending" as const,
  workspacePath: null,
  gatewayUrl: null,
  ecsTaskArn: null,
  errorMessage: null,
  provisionedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_FILES = {
  soul: "# SOUL.md content",
  user: "# USER.md content",
  memory: "# MEMORY.md content",
  agents: "# AGENTS.md content",
  tools: "# TOOLS.md content",
  heartbeat: null,
};

describe("POST /users/onboarding/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUserBySupabaseId.mockResolvedValue(MOCK_USER);
    mockGetStateWithMessages.mockResolvedValue({
      state: MOCK_STATE,
      messages: [],
    });
    mockIsComplete.mockReturnValue(true);
    mockSubFindByUserId.mockResolvedValue(null); // no subscription → "free"
    mockProvFindByUserId.mockResolvedValue(MOCK_PROVISIONING);
    mockResolveWorkspacePath.mockReturnValue(
      "/tmp/workspace/db-user-123/workspace",
    );
    mockGenerateWorkspaceFiles.mockReturnValue(MOCK_FILES);
    mockWriteWorkspaceFiles.mockResolvedValue(undefined);
    mockUpdateById.mockResolvedValue(undefined);
    mockUpdateProvisioned.mockResolvedValue(undefined);
    mockUpdateOnboardingAnswers.mockResolvedValue(undefined);
    mockMarkCompleted.mockResolvedValue({
      ...MOCK_STATE,
      status: "completed",
    });
  });

  describe("happy path", () => {
    it("returns 200 with success on a clean completion", async () => {
      const res = await onboardingHandler.handle(makeRequest());
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(true);
    });

    it("writes workspace files to the resolved path", async () => {
      await onboardingHandler.handle(makeRequest());
      expect(mockWriteWorkspaceFiles).toHaveBeenCalledWith(
        "/tmp/workspace/db-user-123/workspace",
        MOCK_FILES,
      );
    });

    it("sets users.onboardingCompleted = true after the file write", async () => {
      await onboardingHandler.handle(makeRequest());
      expect(mockUpdateById).toHaveBeenCalledWith("db-user-123", {
        onboardingCompleted: true,
      });
    });

    it("marks the onboardingState row completed", async () => {
      await onboardingHandler.handle(makeRequest());
      expect(mockMarkCompleted).toHaveBeenCalledWith("db-user-123");
    });

    it("uses subscription tier when generating files", async () => {
      mockSubFindByUserId.mockResolvedValue({
        tier: "premium",
        status: "active",
      });
      await onboardingHandler.handle(makeRequest());
      expect(mockGenerateWorkspaceFiles).toHaveBeenCalledWith(
        MOCK_STATE.collectedAnswers,
        "premium",
      );
    });

    it("defaults to the free tier when subscription is absent", async () => {
      mockSubFindByUserId.mockResolvedValue(null);
      await onboardingHandler.handle(makeRequest());
      expect(mockGenerateWorkspaceFiles).toHaveBeenCalledWith(
        MOCK_STATE.collectedAnswers,
        "free",
      );
    });

    it("creates a pending provisioning row when none exists yet", async () => {
      mockProvFindByUserId.mockResolvedValue(null);
      mockProvCreate.mockResolvedValue(MOCK_PROVISIONING);
      await onboardingHandler.handle(makeRequest());
      expect(mockProvCreate).toHaveBeenCalledWith({
        userId: "db-user-123",
        status: "pending",
      });
    });
  });

  describe("ordering guarantee: users.onboardingCompleted set only after file write", () => {
    it("marks the user complete AFTER writing files, not before", async () => {
      const callOrder: string[] = [];
      mockWriteWorkspaceFiles.mockImplementation(async () => {
        callOrder.push("writeFiles");
      });
      mockUpdateById.mockImplementation(async () => {
        callOrder.push("setUserComplete");
      });
      mockMarkCompleted.mockImplementation(async () => {
        callOrder.push("markStateComplete");
        return { ...MOCK_STATE, status: "completed" };
      });

      await onboardingHandler.handle(makeRequest());

      expect(callOrder[0]).toBe("writeFiles");
      expect(callOrder[1]).toBe("setUserComplete");
      expect(callOrder[2]).toBe("markStateComplete");
    });
  });

  describe("file write failure must not mark the user complete", () => {
    it("returns 500 when writeWorkspaceFiles throws", async () => {
      mockWriteWorkspaceFiles.mockRejectedValue(new Error("EFS unavailable"));
      const res = await onboardingHandler.handle(makeRequest());
      expect(res.status).toBe(500);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
    });

    it("does NOT set users.onboardingCompleted when file write fails", async () => {
      mockWriteWorkspaceFiles.mockRejectedValue(new Error("EFS unavailable"));
      await onboardingHandler.handle(makeRequest());
      expect(mockUpdateById).not.toHaveBeenCalledWith("db-user-123", {
        onboardingCompleted: true,
      });
    });

    it("does NOT stamp the onboardingState row when file write fails", async () => {
      mockWriteWorkspaceFiles.mockRejectedValue(new Error("EFS unavailable"));
      await onboardingHandler.handle(makeRequest());
      expect(mockMarkCompleted).not.toHaveBeenCalled();
    });
  });

  describe("validation errors", () => {
    it("returns 404 when the user is not found", async () => {
      mockGetUserBySupabaseId.mockResolvedValue(null);
      const res = await onboardingHandler.handle(makeRequest());
      expect(res.status).toBe(404);
    });

    it("returns 400 when no onboarding state exists", async () => {
      mockGetStateWithMessages.mockResolvedValue({
        state: null,
        messages: [],
      });
      const res = await onboardingHandler.handle(makeRequest());
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
    });

    it("returns 400 when required questions are not all answered", async () => {
      mockIsComplete.mockReturnValue(false);
      const res = await onboardingHandler.handle(makeRequest());
      expect(res.status).toBe(400);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.success).toBe(false);
      expect(String(body.error)).toMatch(/not complete/i);
    });

    it("does not write any files when required questions are unanswered", async () => {
      mockIsComplete.mockReturnValue(false);
      await onboardingHandler.handle(makeRequest());
      expect(mockWriteWorkspaceFiles).not.toHaveBeenCalled();
    });
  });
});
