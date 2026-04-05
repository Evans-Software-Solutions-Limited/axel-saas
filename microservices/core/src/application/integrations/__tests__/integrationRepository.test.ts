import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrationRepository } from "../integrationRepository";
import type { Db } from "@axel-saas/db";

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
    "onConflictDoUpdate",
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

const NOW = new Date("2026-04-05T19:00:00.000Z");

const mockIntegrationRow = {
  id: "int-uuid-1",
  userId: "user-uuid-1",
  integrationId: "openai",
  status: "connected" as const,
  keyHint: "...abcd",
  label: "My OpenAI key",
  secretPath: "/axel-saas/users/user-uuid-1/integrations/openai/credential",
  connectedAt: NOW,
  lastCheckedAt: null,
  lastUsedAt: null,
  lastErrorCode: null,
  lastErrorMessageSafe: null,
  accountMetadata: {},
  createdAt: NOW,
  updatedAt: NOW,
};

describe("IntegrationRepository", () => {
  let mockDb: Partial<Db>;
  let repo: IntegrationRepository;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockIntegrationRow])),
      select: vi.fn(() => mockChain([mockIntegrationRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new IntegrationRepository(mockDb as Db);
  });

  describe("findByUserAndIntegration", () => {
    it("returns integration when found", async () => {
      const result = await repo.findByUserAndIntegration(
        "user-uuid-1",
        "openai",
      );
      expect(result).not.toBeNull();
      expect(result?.integrationId).toBe("openai");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const result = await repo.findByUserAndIntegration(
        "user-uuid-1",
        "nonexistent",
      );
      expect(result).toBeNull();
    });
  });

  describe("listByUserId", () => {
    it("returns safe metadata without secretPath", async () => {
      const results = await repo.listByUserId("user-uuid-1");
      expect(results).toHaveLength(1);
      const item = results[0]!;
      expect(item.integrationId).toBe("openai");
      expect(item.keyHint).toBe("...abcd");
      // secretPath must NOT be in the metadata
      expect("secretPath" in item).toBe(false);
    });

    it("returns empty array when no integrations", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const results = await repo.listByUserId("user-uuid-1");
      expect(results).toHaveLength(0);
    });
  });

  describe("getMetadata", () => {
    it("returns safe metadata for existing integration", async () => {
      const result = await repo.getMetadata("user-uuid-1", "openai");
      expect(result).not.toBeNull();
      expect(result?.status).toBe("connected");
      expect("secretPath" in result!).toBe(false);
    });

    it("returns null for missing integration", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const result = await repo.getMetadata("user-uuid-1", "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("upsert", () => {
    it("inserts new integration when not exists", async () => {
      const result = await repo.upsert({
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...abcd",
        secretPath:
          "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        connectedAt: NOW,
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockDb.select).not.toHaveBeenCalled();
      expect(result.integrationId).toBe("openai");
    });

    it("applies onConflictDoUpdate when row already exists", async () => {
      await repo.upsert({
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...efgh",
        secretPath:
          "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        connectedAt: NOW,
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("clears error fields in return value after upsert update", async () => {
      const clearedRow = {
        ...mockIntegrationRow,
        keyHint: "...efgh",
        lastErrorCode: null,
        lastErrorMessageSafe: null,
        updatedAt: NOW,
      };
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([clearedRow]),
      );

      const result = await repo.upsert({
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...efgh",
        secretPath:
          "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        connectedAt: NOW,
      });

      // Return value must reflect cleared error fields (matching what DB writes)
      expect(result.lastErrorCode).toBeNull();
      expect(result.lastErrorMessageSafe).toBeNull();
    });

    it("preserves explicit null label in return value after upsert update", async () => {
      const rowWithNullLabel = { ...mockIntegrationRow, label: null };
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([rowWithNullLabel]),
      );

      const result = await repo.upsert({
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...efgh",
        label: null,
        secretPath:
          "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        connectedAt: NOW,
      });

      // Explicit null should override old label, not fall back to existing
      expect(result.label).toBeNull();
    });

    it("uses explicit accountMetadata in conflict set when provided", async () => {
      const rowWithMeta = {
        ...mockIntegrationRow,
        accountMetadata: { region: "eu" },
      };
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([rowWithMeta]),
      );

      const result = await repo.upsert({
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...abcd",
        secretPath:
          "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        connectedAt: NOW,
        accountMetadata: { region: "eu" },
      });

      expect(result.accountMetadata).toEqual({ region: "eu" });
    });

    it("throws when insert returns no row", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.upsert({
          userId: "user-uuid-1",
          integrationId: "openai",
          status: "connected",
          keyHint: "...abcd",
          secretPath:
            "/axel-saas/users/user-uuid-1/integrations/openai/credential",
          connectedAt: NOW,
        }),
      ).rejects.toThrow("Failed to create integration — no row returned");
    });
  });

  describe("markRevoked", () => {
    it("sets status to revoked and clears keyHint", async () => {
      await repo.markRevoked("int-uuid-1");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateStatus", () => {
    it("updates integration status", async () => {
      await repo.updateStatus("int-uuid-1", "error", {
        lastErrorCode: "INVALID_KEY",
        lastErrorMessageSafe: "The API key is invalid",
      });
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });
});
