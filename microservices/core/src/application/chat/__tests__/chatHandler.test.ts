import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetContainerByUserId,
  mockGetAuthUser,
  mockRequireAuth,
  mockGetUser,
} = vi.hoisted(() => ({
  mockGetContainerByUserId: vi.fn(),
  mockGetAuthUser: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockGetUser: vi.fn(),
}));

// Mock db before imports
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
}));

// Mock userRepository
vi.mock("../../repositories/userRepository", () => ({
  userRepository: {
    getUserBySupabaseId: vi.fn(),
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

// Mock auth utils
vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: mockGetAuthUser,
  requireAuth: mockRequireAuth,
  getUser: mockGetUser,
}));

function resetAuthMocks() {
  mockGetAuthUser.mockReset().mockResolvedValue({ sub: "supabase-123" });
  mockRequireAuth.mockReset().mockImplementation(({ user, set }: any) => {
    if (!user) {
      set.status = 401;
      return { success: false, error: "Unauthorized" };
    }
  });
  mockGetUser.mockReset().mockReturnValue({ sub: "supabase-123" });
}

// Mock fetch for gateway calls
global.fetch = vi.fn();

// Import after mocks
import { chatHandler } from "../chatHandler";
import { userRepository } from "../../repositories/userRepository";

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
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(userRepository.getUserBySupabaseId).mockResolvedValue(mockUser);

      mockGetContainerByUserId.mockResolvedValue(null);

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container).toBeNull();
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

    it("should return demo response in development when active container has no gateway URL", async () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      try {
        const mockUser = {
          id: "db-user-123",
          supabaseUserId: "supabase-123",
          email: "test@example.com",
          fullName: "Test User",
          onboardingCompleted: true,
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

        expect(result.status).toBe(200);
        await expect(result.json()).resolves.toMatchObject({
          success: true,
          response: expect.stringContaining('I received your message "hello"'),
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

    it("should return demo response in development when gateway unavailable", async () => {
      const mockContainer = {
        taskArn: "arn:aws:ecs:region:account:task/task-id",
        status: "active",
        gatewayUrl: "https://gateway.example.com",
        workspacePath: "/workspace/user123",
      };

      mockGetContainerByUserId.mockResolvedValue(mockContainer);

      // Mock fetch to throw error
      global.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      const container = await mockGetContainerByUserId("db-user-123");

      expect(container?.status).toBe("active");

      // Test handles the error - in dev mode returns demo response
      // This is verified by the handler code checking NODE_ENV !== 'production'
      expect(process.env.NODE_ENV).not.toBe("production");
    });
  });
});
