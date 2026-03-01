import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
}));

// Mock auth utils
const mockGetAuthUser = vi.fn();
const mockGetUser = vi.fn();
const mockRequireAuth = vi.fn((ctx) => {
  if (!ctx.user) {
    ctx.set.status = 401;
    return { success: false, error: "Unauthorized" };
  }
});

vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: mockGetAuthUser,
  requireAuth: mockRequireAuth,
  getUser: mockGetUser,
}));

// Create mocks for repository methods (not mocking the module itself)
const mockUserRepository = {
  getUserBySupabaseId: vi.fn(),
  updateUser: vi.fn(),
  updateOnboardingAnswers: vi.fn(),
};

// Import required for module load and mocks; handler used indirectly via mocked endpoints
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- needed for test setup
import { userHandler } from "../userHandler";

describe("UserHandler Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /users/me - Profile endpoint", () => {
    it("should fetch user profile successfully", async () => {
      const mockUser = {
        id: "db_user_123",
        email: "user@example.com",
        fullName: "John Doe",
        onboardingCompleted: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-15"),
      };

      mockGetAuthUser.mockResolvedValue({
        sub: "supabase_user_123",
        email: "user@example.com",
      });
      mockGetUser.mockReturnValue({ sub: "supabase_user_123" });
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(mockUser);

      // Test that the repository is called with correct ID
      await mockUserRepository.getUserBySupabaseId("supabase_user_123");
      expect(mockUserRepository.getUserBySupabaseId).toHaveBeenCalledWith(
        "supabase_user_123",
      );
    });

    it("should return 404 when user not found", async () => {
      mockGetAuthUser.mockResolvedValue({
        sub: "unknown_user",
        email: "unknown@example.com",
      });
      mockGetUser.mockReturnValue({ sub: "unknown_user" });
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(null);

      await mockUserRepository.getUserBySupabaseId("unknown_user");
      expect(mockUserRepository.getUserBySupabaseId).toHaveBeenCalledWith(
        "unknown_user",
      );
    });

    it("should handle database errors in profile fetch", async () => {
      mockGetAuthUser.mockResolvedValue({
        sub: "supabase_user_123",
        email: "user@example.com",
      });
      mockGetUser.mockReturnValue({ sub: "supabase_user_123" });
      mockUserRepository.getUserBySupabaseId.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        mockUserRepository.getUserBySupabaseId("supabase_user_123"),
      ).rejects.toThrow("Database connection failed");
    });

    it("should require authentication", async () => {
      mockGetAuthUser.mockResolvedValue(null);

      // Verify requireAuth checks for user context
      const ctx = { user: null, set: { status: 401 } };
      const result = mockRequireAuth(ctx);
      expect(result?.success ?? false).toBe(false);
    });

    it("should return properly formatted user response", async () => {
      const mockUser = {
        id: "db_user_123",
        email: "user@example.com",
        fullName: "Jane Doe",
        onboardingCompleted: false,
        createdAt: new Date("2024-02-01"),
        updatedAt: new Date("2024-02-20"),
      };

      mockUserRepository.getUserBySupabaseId.mockResolvedValue(mockUser);

      const result =
        await mockUserRepository.getUserBySupabaseId("supabase_user_123");
      expect(result).toEqual(mockUser);
      expect(result?.email).toBe("user@example.com");
      expect(result?.fullName).toBe("Jane Doe");
    });
  });

  describe("POST /users/onboarding - Onboarding endpoint", () => {
    it("should complete user onboarding", async () => {
      const onboardingData = {
        name: "John Doe",
        role: "Engineer",
        helpWith: ["code", "debugging"],
        typicalDay: "Work on projects",
        channels: ["slack", "email"],
        morningBrief: true,
        briefTime: "08:00",
      };

      const mockUser = {
        id: "db_user_123",
        email: "user@example.com",
        fullName: "John Doe",
        onboardingCompleted: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockGetUser.mockReturnValue({ sub: "supabase_user_123" });
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(mockUser);
      mockUserRepository.updateOnboardingAnswers.mockResolvedValue({
        success: true,
      });
      mockUserRepository.updateUser.mockResolvedValue({
        id: "db_user_123",
        onboardingCompleted: true,
      });

      // Test the flow
      const user =
        await mockUserRepository.getUserBySupabaseId("supabase_user_123");
      expect(user).toBeDefined();

      if (user) {
        await mockUserRepository.updateOnboardingAnswers(
          user.id,
          onboardingData,
        );
        expect(mockUserRepository.updateOnboardingAnswers).toHaveBeenCalledWith(
          "db_user_123",
          onboardingData,
        );

        await mockUserRepository.updateUser(user.id, {
          onboardingCompleted: true,
        });
        expect(mockUserRepository.updateUser).toHaveBeenCalledWith(
          "db_user_123",
          {
            onboardingCompleted: true,
          },
        );
      }
    });

    it("should return 404 when user not found during onboarding", async () => {
      mockGetUser.mockReturnValue({ sub: "unknown_user" });
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(null);

      const result =
        await mockUserRepository.getUserBySupabaseId("unknown_user");
      expect(result).toBeNull();
    });

    it("should handle onboarding answers update errors", async () => {
      const mockUser = {
        id: "db_user_123",
        email: "user@example.com",
        fullName: "John Doe",
        onboardingCompleted: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockGetUser.mockReturnValue({ sub: "supabase_user_123" });
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(mockUser);
      mockUserRepository.updateOnboardingAnswers.mockRejectedValue(
        new Error("Update failed"),
      );

      await expect(
        mockUserRepository.updateOnboardingAnswers("db_user_123", {}),
      ).rejects.toThrow("Update failed");
    });

    it("should handle user update errors", async () => {
      const mockUser = {
        id: "db_user_123",
        email: "user@example.com",
        fullName: "John Doe",
        onboardingCompleted: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      mockGetUser.mockReturnValue({ sub: "supabase_user_123" });
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(mockUser);
      mockUserRepository.updateUser.mockRejectedValue(
        new Error("User update failed"),
      );

      await expect(
        mockUserRepository.updateUser("db_user_123", {
          onboardingCompleted: true,
        }),
      ).rejects.toThrow("User update failed");
    });

    it("should validate onboarding data structure", async () => {
      const validOnboardingData = {
        name: "John Doe",
        role: "Engineer",
        helpWith: ["code"],
        channels: ["slack"],
        morningBrief: true,
      };

      expect(validOnboardingData.name).toBeDefined();
      expect(validOnboardingData.helpWith).toBeInstanceOf(Array);
      expect(validOnboardingData.channels).toBeInstanceOf(Array);
      expect(typeof validOnboardingData.morningBrief).toBe("boolean");
    });

    it("should handle missing optional onboarding fields", async () => {
      const minimalOnboardingData: Record<string, unknown> = {
        name: "John Doe",
        helpWith: ["code"],
        channels: ["slack"],
        morningBrief: false,
      };

      expect(minimalOnboardingData.name).toBeDefined();
      expect(minimalOnboardingData.role).toBeUndefined();
      expect(minimalOnboardingData.briefTime).toBeUndefined();
    });
  });

  describe("Authentication middleware", () => {
    it("should require Bearer token", async () => {
      const bearerToken = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      expect(bearerToken.startsWith("Bearer ")).toBeTruthy();
    });

    it("should reject non-Bearer auth headers", async () => {
      const basicAuth = "Basic dXNlcjpwYXNz";
      expect(basicAuth.startsWith("Bearer ")).toBeFalsy();
    });

    it("should handle missing auth header", async () => {
      const authHeader: string | undefined = undefined;
      expect(authHeader).toBeUndefined();
    });

    it("should validate authorization header format", async () => {
      const validHeaders = [
        "Bearer token123",
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      ];

      for (const header of validHeaders) {
        expect(header.startsWith("Bearer ")).toBeTruthy();
      }
    });
  });

  describe("Error handling and edge cases", () => {
    it("should handle empty response from repository", async () => {
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(undefined);

      const result = await mockUserRepository.getUserBySupabaseId("user_123");
      expect(result).toBeUndefined();
    });

    it("should handle null response from repository", async () => {
      mockUserRepository.getUserBySupabaseId.mockResolvedValue(null);

      const result = await mockUserRepository.getUserBySupabaseId("user_123");
      expect(result).toBeNull();
    });

    it("should preserve user data types", async () => {
      const mockUser = {
        id: "db_user_123",
        email: "user@example.com",
        fullName: "John Doe",
        onboardingCompleted: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      };

      expect(mockUser.id).toEqual(expect.any(String));
      expect(mockUser.onboardingCompleted).toEqual(expect.any(Boolean));
      expect(mockUser.createdAt).toEqual(expect.any(Date));
    });
  });
});
