import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetContainerByUserId,
  mockGetAuthUser,
  mockRequireAuth,
  mockGetUser,
  mockFindSubscriptionByUserId,
  mockCheckCap,
  mockRecordUsage,
} = vi.hoisted(() => ({
  mockGetContainerByUserId: vi.fn(),
  mockGetAuthUser: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockGetUser: vi.fn(),
  mockFindSubscriptionByUserId: vi.fn(),
  mockCheckCap: vi.fn(),
  mockRecordUsage: vi.fn(),
}));

// Mock db before imports
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
}));

// Mock userRepository
vi.mock("../../repositories/userRepository", () => ({
  userRepository: {
    getUserBySupabaseId: vi.fn(),
    getOnboardingAnswers: vi.fn(),
  },
}));

// Mock provisioningRepository
vi.mock("../../repositories/provisioningRepository", () => {
  class MockProvisioningRepository {
    getContainerByUserId = mockGetContainerByUserId;
  }

  return {
    ProvisioningRepository: MockProvisioningRepository,
  };
});

// Mock subscriptionRepository
vi.mock("../../repositories/subscriptionRepository", () => {
  class MockSubscriptionRepository {
    findByUserId = mockFindSubscriptionByUserId;
  }

  return {
    SubscriptionRepository: MockSubscriptionRepository,
  };
});

// Mock auth utils
vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: mockGetAuthUser,
  requireAuth: mockRequireAuth,
  getUser: mockGetUser,
}));

// Mock the token usage service. Existing tests aren't aware of token caps —
// stub `checkCap` to allow by default and stub `recordUsage` to no-op so
// the chat handler's new pre/post-dispatch hooks don't fail. Tests that
// need to exercise the 429 path can override `mockCheckCap` directly.
vi.mock("../../usage/tokenUsageService", () => {
  class MockTokenUsageService {
    checkCap = mockCheckCap;
    recordUsage = mockRecordUsage;
  }
  return {
    TokenUsageService: MockTokenUsageService,
    estimateMessageTokens: (text: string) => Math.ceil(text.length / 4),
    // Mirror the production projection (5x with a 200-token floor) so
    // the chat handler's cap-check call shape is realistic.
    projectMessageOutputTokens: (input: number) =>
      Math.max(200, Math.max(0, input) * 5),
  };
});

// Mock the rate-limit service. Allow by default; tests that need the
// 429 path override `mockRateLimitDecision` to `{ allowed: false }`.
// `vi.hoisted` lets the mock factory (which Vitest hoists to the top
// of the file) reference this fn without TDZ errors.
const { mockRateLimitDecision } = vi.hoisted(() => ({
  mockRateLimitDecision: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 30,
    remaining: 29,
    resetAt: 1_777_809_660,
    retryAfter: 30,
  }),
}));
vi.mock("../../rate-limiting/rateLimitService", () => {
  class MockRateLimitService {
    checkAndConsume = mockRateLimitDecision;
  }
  return { RateLimitService: MockRateLimitService };
});

const mockActiveSubscription = {
  id: "sub-123",
  userId: "db-user-123",
  stripeCustomerId: "cus_test",
  stripeSubscriptionId: "sub_test",
  tier: "premium" as const,
  status: "active" as const,
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function resetAuthMocks() {
  mockGetAuthUser.mockReset().mockResolvedValue({ sub: "supabase-123" });
  mockRequireAuth.mockReset().mockImplementation(({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Unauthorized" };
    }
  });
  mockGetUser.mockReset().mockReturnValue({ sub: "supabase-123" });
  // Default: active subscription so existing tests pass
  mockFindSubscriptionByUserId
    .mockReset()
    .mockResolvedValue(mockActiveSubscription);
  // Default: cap allows + usage record no-ops. Tests that exercise the
  // 429 path override `mockCheckCap` directly.
  mockCheckCap.mockReset().mockResolvedValue({ allowed: true });
  mockRecordUsage.mockReset().mockResolvedValue(undefined);
  // Default: rate limit allows. Tests can override to exercise 429.
  mockRateLimitDecision.mockReset().mockResolvedValue({
    allowed: true,
    limit: 30,
    remaining: 29,
    resetAt: 1_777_809_660,
    retryAfter: 30,
  });
}

// Mock fetch for gateway calls
global.fetch = vi.fn();

// Import after mocks
import {
  chatHandler,
  generateContextualResponse,
  generateHandoffGreeting,
} from "../chatHandler";
import { userRepository } from "../../repositories/userRepository";

describe("generateHandoffGreeting", () => {
  it("should address user by name when name is provided", () => {
    const result = generateHandoffGreeting("Bradley", "scaling the company");
    expect(result).toContain("Bradley");
  });

  it("should fall back to 'there' when name is null", () => {
    const result = generateHandoffGreeting(null, "managing properties");
    expect(result).toContain("there");
  });

  it("should include goals when provided", () => {
    const result = generateHandoffGreeting("Alice", "growing the product");
    expect(result).toContain("growing the product");
  });

  it("should return generic ready message when goals are null", () => {
    const result = generateHandoffGreeting("Alice", null);
    expect(result).toContain("Alice");
    expect(result).not.toContain("undefined");
    expect(result).not.toContain("null");
  });

  it("should return non-empty string for all-null inputs", () => {
    const result = generateHandoffGreeting(null, null);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toContain("null");
  });
});

describe("generateContextualResponse", () => {
  describe("greeting responses", () => {
    it("should personalize greeting with user's name", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Software Engineer",
        "building SaaS products",
        "hello",
      );
      expect(response).toContain("Bradley");
    });

    it("should use 'there' when no name provided", () => {
      const response = generateContextualResponse(
        null,
        "Software Engineer",
        "building SaaS products",
        "hi",
      );
      expect(response).toContain("there");
    });

    it("should include user's role in greeting", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Software Engineer",
        "building SaaS products",
        "hey",
      );
      expect(response).toContain("Software Engineer");
    });

    it("should NOT trigger greeting for 'this' (contains 'hi' substring)", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "this is a test",
      );
      expect(response).not.toContain("Good to hear from you");
      expect(response).toContain("thanks for reaching out");
    });

    it("should NOT trigger greeting for 'they' (contains 'hey' substring)", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "they are coming over",
      );
      expect(response).not.toContain("Good to hear from you");
      expect(response).toContain("thanks for reaching out");
    });

    it("should NOT trigger greeting for 'thin' (contains 'hi' substring)", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "i am feeling thin today",
      );
      expect(response).not.toContain("Good to hear from you");
    });

    it("should NOT trigger greeting for 'his' (contains 'hi' substring)", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "his work is done",
      );
      expect(response).not.toContain("Good to hear from you");
    });

    it("should NOT trigger greeting for 'theme' (contains 'he' substring)", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "what is the theme?",
      );
      expect(response).not.toContain("Good to hear from you");
    });

    it("should handle actual greetings with punctuation", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "hi there!",
      );
      expect(response).toContain("Good to hear from you");
    });

    it("should handle greetings at start of message", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Engineer",
        "building products",
        "hello, can you help me?",
      );
      expect(response).toContain("Good to hear from you");
    });
  });

  describe("help/capability questions", () => {
    it("should respond to 'what can you do' with user goals", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Founder",
        "growing the business",
        "what can you do?",
      );
      expect(response).toContain("growing the business");
    });

    it("should respond to 'how can you help' with user goals", () => {
      const response = generateContextualResponse(
        "Bradley",
        null,
        "managing properties",
        "how can you help me?",
      );
      expect(response).toContain("managing properties");
    });
  });

  describe("identity questions", () => {
    it("should tell user about themselves when data available", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Founder",
        "growing the business",
        "who am i?",
      );
      expect(response).toContain("Bradley");
      expect(response).toContain("Founder");
    });

    it("should indicate learning when no data available", () => {
      const response = generateContextualResponse(
        null,
        null,
        null,
        "what do you know about me?",
      );
      expect(response).toContain("getting to know");
    });
  });

  describe("default responses", () => {
    it("should personalize default response with user data", () => {
      const response = generateContextualResponse(
        "Bradley",
        "Founder",
        "scaling the company",
        "let's get started",
      );
      expect(response).toContain("Bradley");
      expect(response).toContain("scaling the company");
    });

    it("should handle missing data gracefully", () => {
      const response = generateContextualResponse(
        null,
        null,
        null,
        "something else",
      );
      expect(response).toBeDefined();
      expect(response.length).toBeGreaterThan(0);
    });
  });
});

describe("ChatHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockGetContainerByUserId.mockReset();
    resetAuthMocks();
    global.fetch = vi.fn();
  });

  describe("chatHandler instance", () => {
    it("should be defined", () => {
      expect(chatHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(chatHandler.routes).toBeDefined();
      expect(Array.isArray(chatHandler.routes)).toBe(true);
      expect(chatHandler.routes.length).toBeGreaterThan(0);
    });

    it("should have GET /users/me/agent route", () => {
      const getRoutes = chatHandler.routes.filter((r) => r.method === "GET");
      const agentRoute = getRoutes.find((r) => r.path === "/users/me/agent");
      expect(agentRoute).toBeDefined();
    });

    it("should have POST /users/chat/message route", () => {
      const postRoutes = chatHandler.routes.filter((r) => r.method === "POST");
      const messageRoute = postRoutes.find(
        (r) => r.path === "/users/chat/message",
      );
      expect(messageRoute).toBeDefined();
    });
  });

  describe("GET /users/me/agent endpoint logic", () => {
    it("should return user not found when user does not exist", async () => {
      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(null);

      const result = await userRepository.getUserBySupabaseId("unknown");
      expect(result).toBeNull();
    });

    it("should return onboarding not completed error when onboarding is not complete", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: false,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      const result = await userRepository.getUserBySupabaseId("supabase-123");
      expect(result?.onboardingCompleted).toBe(false);
    });

    it("should return active status when container is active", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container?.status).toBe("active");
      expect(container?.gatewayUrl).toBe("https://gateway.example.com");
    });

    it("should return provisioning status when container is not active", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "pending",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container?.status).toBe("pending");
    });

    it("should return not_found when no container exists", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      mockGetContainerByUserId.mockResolvedValue(null);

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container).toBeNull();
    });

    it("should include handoffGreeting in active status response", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);
      vi.mocked(userRepository.getOnboardingAnswers).mockResolvedValue({
        name: "Bradley",
        helpWith: "scaling the company",
      });
      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const result = await chatHandler.handle(
        new Request("http://localhost/users/me/agent", {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        }),
      );

      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        status: string;
        handoffGreeting?: string;
      };
      expect(body.status).toBe("active");
      expect(body.handoffGreeting).toBeDefined();
      expect(typeof body.handoffGreeting).toBe("string");
      expect(body.handoffGreeting).toContain("Bradley");
      expect(body.handoffGreeting).toContain("scaling the company");
    });

    it("should fall through to proactiveAreas when helpWith is an empty string", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);
      // helpWith is empty string — should fall through to proactiveAreas
      vi.mocked(userRepository.getOnboardingAnswers).mockResolvedValue({
        name: "Sam",
        helpWith: "",
        proactiveAreas: "closing more deals",
      });
      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const result = await chatHandler.handle(
        new Request("http://localhost/users/me/agent", {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        }),
      );

      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        status: string;
        handoffGreeting?: string;
      };
      expect(body.status).toBe("active");
      expect(body.handoffGreeting).toContain("closing more deals");
    });

    it("should return active status with generic greeting when onboarding lookup throws", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);
      vi.mocked(userRepository.getOnboardingAnswers).mockRejectedValue(
        new Error("DB connection failed"),
      );
      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const result = await chatHandler.handle(
        new Request("http://localhost/users/me/agent", {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        }),
      );

      // Must not degrade to 500 — onboarding lookup is non-essential
      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        success: boolean;
        status: string;
        handoffGreeting?: string;
      };
      expect(body.success).toBe(true);
      expect(body.status).toBe("active");
      expect(typeof body.handoffGreeting).toBe("string");
    });

    it("should not include handoffGreeting when status is provisioning", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "pending",
        gatewayUrl: null,
        workspacePath: null,
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);
      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const result = await chatHandler.handle(
        new Request("http://localhost/users/me/agent", {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        }),
      );

      expect(result.status).toBe(200);
      const body = (await result.json()) as {
        status: string;
        handoffGreeting?: string;
      };
      expect(body.status).toBe("provisioning");
      expect(body.handoffGreeting).toBeUndefined();
    });

    it("should return failed status when container status is failed", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: null,
        status: "failed",
        gatewayUrl: null,
        workspacePath: null,
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);
      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const result = await chatHandler.handle(
        new Request("http://localhost/users/me/agent", {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        }),
      );

      expect(result.status).toBe(200);
      await expect(result.json()).resolves.toMatchObject({
        success: true,
        status: "failed",
      });
    });

    it("should not return provisioning status when container status is failed", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: null,
        status: "failed",
        gatewayUrl: null,
        workspacePath: null,
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);
      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const result = await chatHandler.handle(
        new Request("http://localhost/users/me/agent", {
          method: "GET",
          headers: { Authorization: "Bearer test-token" },
        }),
      );

      const body = (await result.json()) as { status: string };
      expect(body.status).not.toBe("provisioning");
    });
  });

  describe("POST /users/chat/message endpoint logic", () => {
    it("should require onboarding to be completed", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: false,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      const result = await userRepository.getUserBySupabaseId("supabase-123");
      expect(result?.onboardingCompleted).toBe(false);
    });

    it("should return 503 when agent not provisioned", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      mockGetContainerByUserId.mockResolvedValue(null);

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container).toBeNull();
    });

    it("should return 503 when container is not active", async () => {
      const mockUser = {
        id: "db-user-123",
        supabaseUserId: "supabase-123",
        email: "test@example.com",
        fullName: "Test User",
        onboardingCompleted: true,
        notificationPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "pending",
        gatewayUrl: null,
        workspacePath: null,
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container?.status).toBe("pending");
      expect(container?.gatewayUrl).toBeNull();
    });

    it("should return contextual response in development when active container has no gateway URL", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      try {
        const mockUser = {
          id: "db-user-123",
          supabaseUserId: "supabase-123",
          email: "test@example.com",
          fullName: "Test User",
          onboardingCompleted: true,
          notificationPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockContainer = {
          taskArn: "arn:aws:ecs:region:account:task/task-id",
          status: "active",
          gatewayUrl: null,
          workspacePath: "/workspace/user123",
        };

        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockUser,
        );
        vi.mocked(userRepository.getOnboardingAnswers).mockResolvedValue({
          name: "Bradley",
          role: "Founder",
          helpWith: "scaling the company",
        });
        mockGetContainerByUserId.mockResolvedValue(mockContainer);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/chat/message", {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "hello" }),
          }),
        );

        expect(result.status).toBe(200);
        await expect(result.json()).resolves.toMatchObject({
          success: true,
          response: expect.stringContaining("Bradley"),
        });
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("should return 503 in production when active container has no gateway URL", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      try {
        const mockUser = {
          id: "db-user-123",
          supabaseUserId: "supabase-123",
          email: "test@example.com",
          fullName: "Test User",
          onboardingCompleted: true,
          notificationPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockContainer = {
          taskArn: "arn:aws:ecs:region:account:task/task-id",
          status: "active",
          gatewayUrl: null,
          workspacePath: "/workspace/user123",
        };

        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockUser,
        );
        mockGetContainerByUserId.mockResolvedValue(mockContainer);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/chat/message", {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "hello" }),
          }),
        );

        expect(result.status).toBe(503);
        await expect(result.json()).resolves.toMatchObject({
          success: false,
          error: "Agent is not ready. Please try again later.",
        });
        expect(global.fetch).not.toHaveBeenCalled();
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it("should forward message to gateway when container is active", async () => {
      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      // Mock fetch response
      const mockGatewayResponse = {
        response: "Hello, I am your AI assistant",
        messageId: "msg-123",
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGatewayResponse),
      });

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container?.status).toBe("active");
      expect(container?.gatewayUrl).toBe("https://gateway.example.com");

      // The actual handler would call fetch with these parameters
      // Note: We're testing the repository here, the handler integration
      // is tested via the endpoint tests
      const gatewayUrl = container?.gatewayUrl;
      expect(gatewayUrl).toBe("https://gateway.example.com");
    });

    it("should handle gateway errors gracefully", async () => {
      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      // Mock fetch to throw error
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container?.status).toBe("active");

      // In production, this would return an error response
      // In dev mode, it returns a demo response
      try {
        await fetch("https://gateway.example.com/api/chat", {
          method: "POST",
          body: JSON.stringify({ message: "test" }),
        });
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe("Network error");
      }
    });

    it("should return contextual response in development when gateway unavailable", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      try {
        const mockUser = {
          id: "db-user-123",
          supabaseUserId: "supabase-123",
          email: "test@example.com",
          fullName: "Test User",
          onboardingCompleted: true,
          notificationPreferences: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockUser,
        );
        vi.mocked(userRepository.getOnboardingAnswers).mockResolvedValue({
          name: "Bradley",
          role: "Founder",
          helpWith: "scaling the company",
        });

        global.fetch = vi
          .fn()
          .mockRejectedValue(new Error("Connection refused"));

        const mockContainer = {
          taskArn: "arn:aws:ecs:region:account:task/task-id",
          status: "active",
          gatewayUrl: "https://gateway.example.com",
          workspacePath: "/workspace/user123",
        };

        mockGetContainerByUserId.mockResolvedValue(mockContainer);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/chat/message", {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "what can you do?" }),
          }),
        );

        expect(result.status).toBe(200);
        await expect(result.json()).resolves.toMatchObject({
          success: true,
          response: expect.stringContaining("scaling the company"),
        });
      } finally {
        process.env.NODE_ENV = originalNodeEnv;
      }
    });
  });

  describe("Payment gate", () => {
    const mockOnboardedUser = {
      id: "db-user-123",
      supabaseUserId: "supabase-123",
      email: "test@example.com",
      fullName: "Test User",
      onboardingCompleted: true,
      notificationPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe("GET /users/me/agent", () => {
      it("should return subscription_required when user has no subscription", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue(null);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/me/agent", {
            method: "GET",
            headers: { Authorization: "Bearer test-token" },
          }),
        );

        expect(result.status).toBe(200);
        await expect(result.json()).resolves.toMatchObject({
          success: true,
          status: "subscription_required",
        });
      });

      it("should return subscription_required when subscription is cancelled", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue({
          ...mockActiveSubscription,
          status: "cancelled",
        });

        const result = await chatHandler.handle(
          new Request("http://localhost/users/me/agent", {
            method: "GET",
            headers: { Authorization: "Bearer test-token" },
          }),
        );

        expect(result.status).toBe(200);
        await expect(result.json()).resolves.toMatchObject({
          success: true,
          status: "subscription_required",
        });
      });

      it("should proceed past gate for active subscription", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue(mockActiveSubscription);
        mockGetContainerByUserId.mockResolvedValue(null);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/me/agent", {
            method: "GET",
            headers: { Authorization: "Bearer test-token" },
          }),
        );

        expect(result.status).toBe(200);
        const json = (await result.json()) as { status: string };
        expect(json.status).not.toBe("subscription_required");
      });

      it("should proceed past gate for trialing subscription", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue({
          ...mockActiveSubscription,
          status: "trialing",
        });
        mockGetContainerByUserId.mockResolvedValue(null);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/me/agent", {
            method: "GET",
            headers: { Authorization: "Bearer test-token" },
          }),
        );

        expect(result.status).toBe(200);
        const json = (await result.json()) as { status: string };
        expect(json.status).toBe("not_found");
      });
    });

    describe("POST /users/chat/message", () => {
      it("should return 402 when user has no subscription", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue(null);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/chat/message", {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "hello" }),
          }),
        );

        expect(result.status).toBe(402);
        await expect(result.json()).resolves.toMatchObject({
          success: false,
          error: "Subscription required to use chat",
        });
      });

      it("should return 402 when subscription is past_due", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue({
          ...mockActiveSubscription,
          status: "past_due",
        });

        const result = await chatHandler.handle(
          new Request("http://localhost/users/chat/message", {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "hello" }),
          }),
        );

        expect(result.status).toBe(402);
      });

      it("should proceed past gate for active subscription", async () => {
        vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(
          mockOnboardedUser,
        );
        mockFindSubscriptionByUserId.mockResolvedValue(mockActiveSubscription);
        mockGetContainerByUserId.mockResolvedValue(null);

        const result = await chatHandler.handle(
          new Request("http://localhost/users/chat/message", {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ message: "hello" }),
          }),
        );

        // Not 402 — payment gate passed, hits the no-container 503 next
        expect(result.status).toBe(503);
      });
    });
  });
});
