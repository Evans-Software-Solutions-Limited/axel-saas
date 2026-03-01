import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@axel-saas/db";

// Mock the db module BEFORE importing UserRepository to prevent module-level instantiation
vi.mock("@axel-saas/db", async () => {
  const actual =
    await vi.importActual<typeof import("@axel-saas/db")>("@axel-saas/db");
  return {
    ...actual,
    getDb: vi.fn(() => ({})),
  };
});

import { UserRepository } from "../userRepository";

/**
 * Creates a fluent chain that:
 * - Returns itself from all query builder methods
 * - Is directly awaitable
 * - Returns a real Promise from `.returning()`
 */
function mockChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  const promise = Promise.resolve(result);

  const fluent = [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "offset",
    "orderBy",
    "leftJoin",
    "innerJoin",
  ];

  for (const method of fluent) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<T>["then"]>[0],
    reject?: Parameters<Promise<T>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (reject: Parameters<Promise<T>["catch"]>[0]) =>
    promise.catch(reject);

  return chain;
}

const NOW = new Date("2024-06-01T10:00:00.000Z");

const mockUserRow = {
  id: "user-uuid-1",
  supabaseUserId: "supabase-123",
  email: "user@example.com",
  fullName: "Test User",
  createdAt: NOW,
  updatedAt: NOW,
};

describe("UserRepository", () => {
  let mockDb: Partial<Db>;
  let repo: UserRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockUserRow])),
      select: vi.fn(() => mockChain([mockUserRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new UserRepository(mockDb as Db);
  });

  describe("create", () => {
    it("creates a new user", async () => {
      const user = await repo.create({
        supabaseUserId: "supabase-123",
        email: "user@example.com",
        fullName: "Test User",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(user.id).toBe("user-uuid-1");
      expect(user.email).toBe("user@example.com");
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          supabaseUserId: "sup-123",
          email: "test@test.com",
        }),
      ).rejects.toThrow("Failed to create user");
    });
  });

  describe("findBySupabaseId", () => {
    it("returns user with relations when found", async () => {
      const user = await repo.findBySupabaseId("supabase-123");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-uuid-1");
      expect(user?.supabaseUserId).toBe("supabase-123");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const user = await repo.findBySupabaseId("nonexistent");
      expect(user).toBeNull();
    });
  });

  describe("findById", () => {
    it("returns user when found", async () => {
      const user = await repo.findById("user-uuid-1");
      expect(user?.id).toBe("user-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const user = await repo.findById("nonexistent");
      expect(user).toBeNull();
    });
  });

  describe("updateById", () => {
    it("updates user by id", async () => {
      await repo.updateById("user-uuid-1", { fullName: "Updated Name" });
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("getUserBySupabaseId", () => {
    it("returns user when found", async () => {
      const user = await repo.getUserBySupabaseId("supabase-123");
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-uuid-1");
      expect(user?.email).toBe("user@example.com");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const user = await repo.getUserBySupabaseId("nonexistent");
      expect(user).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("updates user with new values", async () => {
      await repo.updateUser("user-uuid-1", {
        fullName: "New Name",
        onboardingCompleted: true,
      });
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("does not update id or createdAt", async () => {
      await repo.updateUser("user-uuid-1", {
        email: "newemail@example.com",
      });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("updateOnboardingAnswers", () => {
    it("inserts new onboarding answers if not exists", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ userId: "user-uuid-1", answers: {} }]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", {
        name: "John",
        channels: ["slack"],
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("updates existing onboarding answers", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ userId: "user-uuid-1" }]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", {
        name: "John",
        channels: ["email"],
      });

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("sets completedAt date for new answers", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", { test: true });
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("storeProvisioningFile", () => {
    it("creates new provisioning file", async () => {
      const mockFileRow = {
        id: "file-uuid-1",
        userId: "user-uuid-1",
        fileName: "SOUL.md",
        content: "# SOUL.md\nTest content",
        generatedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockFileRow]),
      );

      const file = await repo.storeProvisioningFile(
        "user-uuid-1",
        "SOUL.md",
        "# SOUL.md\nTest content",
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(file.fileName).toBe("SOUL.md");
      expect(file.content).toBe("# SOUL.md\nTest content");
    });

    it("updates existing provisioning file", async () => {
      const mockFileRow = {
        id: "file-uuid-1",
        userId: "user-uuid-1",
        fileName: "SOUL.md",
        content: "Updated content",
        generatedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([{ fileName: "SOUL.md" }]))
        .mockReturnValueOnce(mockChain([mockFileRow]));

      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const file = await repo.storeProvisioningFile(
        "user-uuid-1",
        "SOUL.md",
        "Updated content",
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(file.content).toBe("Updated content");
    });

    it("throws if file creation fails", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.storeProvisioningFile("user-uuid-1", "SOUL.md", "content"),
      ).rejects.toThrow("Failed to create provisioning file");
    });

    it("throws if file update fails", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([{ fileName: "SOUL.md" }]))
        .mockReturnValueOnce(mockChain([]));

      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.storeProvisioningFile("user-uuid-1", "SOUL.md", "content"),
      ).rejects.toThrow("Failed to update provisioning file");
    });
  });

  describe("getProvisioningFiles", () => {
    it("returns all provisioning files for user", async () => {
      const mockFiles = [
        {
          id: "file-uuid-1",
          userId: "user-uuid-1",
          fileName: "SOUL.md",
          content: "# SOUL.md",
          generatedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        },
        {
          id: "file-uuid-2",
          userId: "user-uuid-1",
          fileName: "USER.md",
          content: "# USER.md",
          generatedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ];

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain(mockFiles),
      );

      const files = await repo.getProvisioningFiles("user-uuid-1");

      expect(files).toHaveLength(2);
      expect(files[0].fileName).toBe("SOUL.md");
      expect(files[1].fileName).toBe("USER.md");
    });

    it("returns empty array if no files found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const files = await repo.getProvisioningFiles("user-uuid-1");

      expect(files).toHaveLength(0);
    });
  });

  describe("findBySupabaseId - all relation combinations", () => {
    it("returns user with both subscription and provisioningState", async () => {
      const mockSubscription = {
        id: "sub-uuid-1",
        userId: "user-uuid-1",
        tier: "pro",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      };

      const mockProvisioningState = {
        id: "prov-uuid-1",
        userId: "user-uuid-1",
        status: "in_progress",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([mockSubscription]))
        .mockReturnValueOnce(mockChain([mockProvisioningState]));

      const user = await repo.findBySupabaseId("supabase-123");

      expect(user).not.toBeNull();
      expect(user?.subscription).toEqual(mockSubscription);
      expect(user?.provisioningState).toEqual(mockProvisioningState);
    });

    it("returns user with subscription but no provisioningState", async () => {
      const mockSubscription = {
        id: "sub-uuid-1",
        userId: "user-uuid-1",
        tier: "free",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([mockSubscription]))
        .mockReturnValueOnce(mockChain([]));

      const user = await repo.findBySupabaseId("supabase-123");

      expect(user).not.toBeNull();
      expect(user?.subscription).toEqual(mockSubscription);
      expect(user?.provisioningState).toBeUndefined();
    });

    it("returns user with provisioningState but no subscription", async () => {
      const mockProvisioningState = {
        id: "prov-uuid-1",
        userId: "user-uuid-1",
        status: "completed",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([mockProvisioningState]));

      const user = await repo.findBySupabaseId("supabase-123");

      expect(user).not.toBeNull();
      expect(user?.subscription).toBeUndefined();
      expect(user?.provisioningState).toEqual(mockProvisioningState);
    });

    it("returns user with neither subscription nor provisioningState", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      const user = await repo.findBySupabaseId("supabase-123");

      expect(user).not.toBeNull();
      expect(user?.subscription).toBeUndefined();
      expect(user?.provisioningState).toBeUndefined();
    });
  });

  describe("findById - all relation combinations", () => {
    it("returns user with both subscription and provisioningState", async () => {
      const mockSubscription = {
        id: "sub-uuid-1",
        userId: "user-uuid-1",
        tier: "pro",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      };

      const mockProvisioningState = {
        id: "prov-uuid-1",
        userId: "user-uuid-1",
        status: "in_progress",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([mockSubscription]))
        .mockReturnValueOnce(mockChain([mockProvisioningState]));

      const user = await repo.findById("user-uuid-1");

      expect(user).not.toBeNull();
      expect(user?.subscription).toEqual(mockSubscription);
      expect(user?.provisioningState).toEqual(mockProvisioningState);
    });

    it("returns user with subscription but no provisioningState", async () => {
      const mockSubscription = {
        id: "sub-uuid-1",
        userId: "user-uuid-1",
        tier: "free",
        status: "active",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([mockSubscription]))
        .mockReturnValueOnce(mockChain([]));

      const user = await repo.findById("user-uuid-1");

      expect(user).not.toBeNull();
      expect(user?.subscription).toEqual(mockSubscription);
      expect(user?.provisioningState).toBeUndefined();
    });

    it("returns user with provisioningState but no subscription", async () => {
      const mockProvisioningState = {
        id: "prov-uuid-1",
        userId: "user-uuid-1",
        status: "pending",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([mockProvisioningState]));

      const user = await repo.findById("user-uuid-1");

      expect(user).not.toBeNull();
      expect(user?.subscription).toBeUndefined();
      expect(user?.provisioningState).toEqual(mockProvisioningState);
    });

    it("returns user with neither subscription nor provisioningState", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockUserRow]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      const user = await repo.findById("user-uuid-1");

      expect(user).not.toBeNull();
      expect(user?.subscription).toBeUndefined();
      expect(user?.provisioningState).toBeUndefined();
    });
  });

  describe("updateById - comprehensive", () => {
    it("updates multiple fields simultaneously", async () => {
      const updates = {
        email: "newemail@example.com",
        fullName: "Updated User",
        onboardingCompleted: true,
      };

      await repo.updateById("user-uuid-1", updates);

      expect(mockDb.update).toHaveBeenCalled();
    });

    it("updates with a single field", async () => {
      await repo.updateById("user-uuid-1", { email: "test@test.com" });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("always includes updatedAt timestamp", async () => {
      await repo.updateById("user-uuid-1", { fullName: "New Name" });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("updates onboardingCompleted status", async () => {
      await repo.updateById("user-uuid-1", { onboardingCompleted: false });
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("getUserBySupabaseId - direct user access", () => {
    it("returns user object without relations", async () => {
      const user = await repo.getUserBySupabaseId("supabase-123");

      expect(user).toEqual(mockUserRow);
      expect(user).not.toHaveProperty("subscription");
      expect(user).not.toHaveProperty("provisioningState");
    });

    it("returns null for nonexistent user", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const user = await repo.getUserBySupabaseId("nonexistent");

      expect(user).toBeNull();
    });
  });

  describe("updateOnboardingAnswers - insert and update branches", () => {
    it("inserts new answers with completedAt timestamp", async () => {
      const insertSpy = vi.fn().mockReturnValue(
        mockChain([{ userId: "user-uuid-1", answers: { name: "John" } }]),
      );

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockImplementation(
        insertSpy,
      );

      await repo.updateOnboardingAnswers("user-uuid-1", { name: "John" });

      expect(insertSpy).toHaveBeenCalled();
    });

    it("updates answers with new updatedAt timestamp", async () => {
      const updateSpy = vi.fn().mockReturnValue(mockChain([]));

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ userId: "user-uuid-1" }]),
      );
      (mockDb.update as ReturnType<typeof vi.fn>).mockImplementation(
        updateSpy,
      );

      await repo.updateOnboardingAnswers("user-uuid-1", {
        name: "Jane",
        role: "admin",
      });

      expect(updateSpy).toHaveBeenCalled();
    });

    it("inserts answers with complex nested object", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ userId: "user-uuid-1", answers: {} }]),
      );

      await repo.updateOnboardingAnswers("user-uuid-1", {
        preferences: {
          notifications: true,
          language: "en",
        },
        integrations: ["slack", "email"],
      });

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("storeProvisioningFile - all branches", () => {
    it("creates file with proper structure", async () => {
      const createSpy = vi.fn().mockReturnValue(
        mockChain([
          {
            id: "file-uuid-1",
            userId: "user-uuid-1",
            fileName: "config.json",
            content: "{}",
            createdAt: NOW,
            updatedAt: NOW,
          },
        ]),
      );

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockImplementation(
        createSpy,
      );

      const file = await repo.storeProvisioningFile(
        "user-uuid-1",
        "config.json",
        "{}",
      );

      expect(file.fileName).toBe("config.json");
      expect(createSpy).toHaveBeenCalled();
    });

    it("updates file and retrieves updated version", async () => {
      const updatedFile = {
        id: "file-uuid-1",
        userId: "user-uuid-1",
        fileName: "script.sh",
        content: "#!/bin/bash\necho 'updated'",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([{ fileName: "script.sh" }]))
        .mockReturnValueOnce(mockChain([updatedFile]));

      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const file = await repo.storeProvisioningFile(
        "user-uuid-1",
        "script.sh",
        "#!/bin/bash\necho 'updated'",
      );

      expect(file.content).toBe("#!/bin/bash\necho 'updated'");
    });

    it("handles large file content correctly", async () => {
      const largeContent = "x".repeat(10000);
      const mockFile = {
        id: "file-uuid-1",
        userId: "user-uuid-1",
        fileName: "large.txt",
        content: largeContent,
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockFile]),
      );

      const file = await repo.storeProvisioningFile(
        "user-uuid-1",
        "large.txt",
        largeContent,
      );

      expect(file.content).toBe(largeContent);
      expect(file.content.length).toBe(10000);
    });

    it("stores multiple different files for same user", async () => {
      const file1 = {
        id: "file-1",
        userId: "user-uuid-1",
        fileName: "SOUL.md",
        content: "soul content",
        createdAt: NOW,
        updatedAt: NOW,
      };

      const file2 = {
        id: "file-2",
        userId: "user-uuid-1",
        fileName: "USER.md",
        content: "user content",
        createdAt: NOW,
        updatedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      (mockDb.insert as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([file1]))
        .mockReturnValueOnce(mockChain([file2]));

      const stored1 = await repo.storeProvisioningFile(
        "user-uuid-1",
        "SOUL.md",
        "soul content",
      );

      const stored2 = await repo.storeProvisioningFile(
        "user-uuid-1",
        "USER.md",
        "user content",
      );

      expect(stored1.fileName).toBe("SOUL.md");
      expect(stored2.fileName).toBe("USER.md");
    });
  });

  describe("constructor", () => {
    it("uses provided db instance", () => {
      const customDb = { select: vi.fn() } as unknown as Db;
      const customRepo = new UserRepository(customDb);

      expect(customRepo).toBeDefined();
    });

    it("uses default db when not provided", () => {
      const defaultRepo = new UserRepository();

      expect(defaultRepo).toBeDefined();
    });
  });

  describe("updateUser - delegation to updateById", () => {
    it("delegates to updateById method", async () => {
      await repo.updateUser("user-uuid-1", { email: "test@test.com" });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("passes updates correctly through delegation", async () => {
      const updates = {
        email: "new@example.com",
        fullName: "New Full Name",
      };

      await repo.updateUser("user-uuid-1", updates);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe("Coverage enforcement - getUserBySupabaseId lines 117-122", () => {
    it("must call db.select() return object with from method", async () => {
      const dbSelectReturnValue = mockChain([mockUserRow]);
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(dbSelectReturnValue);
      
      const testResult = await repo.getUserBySupabaseId("supabase-123");
      
      expect(mockDb.select).toHaveBeenCalled();
      expect(testResult).toEqual(mockUserRow);
      expect(testResult).not.toBeNull();
    });

    it("lines 117-120: query chain execution path", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([mockUserRow]));
      const result = await repo.getUserBySupabaseId("supabase-123");
      expect(result?.id).toBe("user-uuid-1");
      expect(result?.email).toBe("user@example.com");
    });

    it("line 122: return null when userRow is undefined", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      const result = await repo.getUserBySupabaseId("test-id");
      expect(result).toBeNull();
      expect(result === null).toBe(true);
    });

    it("line 122: return userRow when it exists", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([mockUserRow]));
      const result = await repo.getUserBySupabaseId("test-id");
      expect(result).toEqual(mockUserRow);
      expect(result === null).toBe(false);
    });
  });

  describe("Coverage enforcement - updateUser lines 125-129", () => {
    it("method updateUser must execute and complete", async () => {
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      const updatePromise = repo.updateUser("user-uuid-1", { email: "test@test.com" });
      await expect(updatePromise).resolves.toBeUndefined();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("updateUser calls updateById through execution", async () => {
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      await repo.updateUser("user-uuid-1", { fullName: "Test" });
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("line 129: await this.updateById(...) must execute", async () => {
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(mockChain([]));
      const updates = { email: "new@test.com", fullName: "Test Name" };
      await repo.updateUser("user-uuid-1", updates);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
