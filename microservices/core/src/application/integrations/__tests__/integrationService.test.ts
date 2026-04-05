import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrationService } from "../integrationService";
import { IntegrationRepository } from "../integrationRepository";
import type { SecretsClient } from "../secretsClient";

const NOW = new Date("2026-04-05T19:00:00.000Z");

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "int-uuid-1",
    userId: "user-uuid-1",
    integrationId: "openai",
    status: "connected" as const,
    keyHint: "...abcd",
    label: null,
    secretPath: "/axel-saas/users/user-uuid-1/integrations/openai/credential",
    connectedAt: NOW,
    lastCheckedAt: null,
    lastUsedAt: null,
    lastErrorCode: null,
    lastErrorMessageSafe: null,
    accountMetadata: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("IntegrationService", () => {
  let mockRepo: {
    findByUserAndIntegration: ReturnType<typeof vi.fn>;
    listByUserId: ReturnType<typeof vi.fn>;
    getMetadata: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    markRevoked: ReturnType<typeof vi.fn>;
  };
  let mockSecrets: SecretsClient;
  let service: IntegrationService;

  beforeEach(() => {
    mockRepo = {
      findByUserAndIntegration: vi.fn(),
      listByUserId: vi.fn().mockResolvedValue([]),
      getMetadata: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(makeRow()),
      updateStatus: vi.fn(),
      markRevoked: vi.fn(),
    };
    mockSecrets = {
      putSecret: vi.fn(),
      deleteSecret: vi.fn(),
      secretExists: vi.fn(),
    };
    service = new IntegrationService(
      mockRepo as unknown as IntegrationRepository,
      mockSecrets,
    );
  });

  describe("connect", () => {
    it("stores secret and returns safe response", async () => {
      const result = await service.connect(
        "user-uuid-1",
        "openai",
        "sk-abcdefghijklmnop",
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe("connected");
        expect(result.keyHint).toBe("...mnop");
        expect(result.connectedAt).toBeDefined();
        // CRITICAL: response must NOT contain the credential
        expect(JSON.stringify(result)).not.toContain("sk-abcdefghijklmnop");
      }
    });

    it("writes secret to SecretsManager", async () => {
      await service.connect("user-uuid-1", "openai", "sk-secret-key-value");

      expect(mockSecrets.putSecret).toHaveBeenCalledWith(
        "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        "sk-secret-key-value",
      );
    });

    it("upserts metadata in DB without plaintext secret", async () => {
      await service.connect("user-uuid-1", "openai", "sk-secret-key-value");

      expect(mockRepo.upsert).toHaveBeenCalledOnce();
      const upsertArg = mockRepo.upsert.mock.calls[0]![0];
      // DB metadata must NOT contain the raw credential
      expect(JSON.stringify(upsertArg)).not.toContain("sk-secret-key-value");
      expect(upsertArg.keyHint).toBe("...alue");
      expect(upsertArg.status).toBe("connected");
    });

    it("rejects invalid integration ID", async () => {
      const result = await service.connect(
        "user-uuid-1",
        "invalid-provider",
        "some-key",
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Invalid integration ID");
      }
      expect(mockSecrets.putSecret).not.toHaveBeenCalled();
    });

    it("rejects empty credential", async () => {
      const result = await service.connect("user-uuid-1", "openai", "");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Credential is required");
      }
      expect(mockSecrets.putSecret).not.toHaveBeenCalled();
    });

    it("rejects whitespace-only credential", async () => {
      const result = await service.connect("user-uuid-1", "openai", "   ");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Credential is required");
      }
    });

    it("stores optional label in metadata", async () => {
      await service.connect(
        "user-uuid-1",
        "openai",
        "sk-abcdefghijklmnop",
        "Production key",
      );

      const upsertArg = mockRepo.upsert.mock.calls[0]![0];
      expect(upsertArg.label).toBe("Production key");
    });

    it("accepts all valid integration IDs", async () => {
      const validIds = [
        "openai",
        "anthropic",
        "elevenlabs",
        "telegram-bot",
        "google",
        "slack",
        "github",
      ];

      for (const id of validIds) {
        const result = await service.connect(
          "user-uuid-1",
          id,
          "sk-long-enough-key",
        );
        expect(result.success).toBe(true);
      }
    });
  });

  describe("list", () => {
    it("returns safe metadata array", async () => {
      const metadata = {
        id: "int-uuid-1",
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...abcd",
        label: null,
        connectedAt: NOW,
        lastCheckedAt: null,
        lastUsedAt: null,
        lastErrorCode: null,
        lastErrorMessageSafe: null,
        accountMetadata: {},
        createdAt: NOW,
        updatedAt: NOW,
      };
      mockRepo.listByUserId.mockResolvedValue([metadata]);

      const results = await service.list("user-uuid-1");
      expect(results).toHaveLength(1);
      // Verify no secret-related fields leak
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain("secretPath");
    });
  });

  describe("get", () => {
    it("returns safe metadata for single integration", async () => {
      const metadata = {
        id: "int-uuid-1",
        userId: "user-uuid-1",
        integrationId: "openai",
        status: "connected",
        keyHint: "...abcd",
      };
      mockRepo.getMetadata.mockResolvedValue(metadata);

      const result = await service.get("user-uuid-1", "openai");
      expect(result).not.toBeNull();
      expect(result?.keyHint).toBe("...abcd");
    });

    it("returns null for missing integration", async () => {
      const result = await service.get("user-uuid-1", "nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("revoke", () => {
    it("deletes secret and marks as revoked", async () => {
      mockRepo.findByUserAndIntegration.mockResolvedValue(makeRow());

      const result = await service.revoke("user-uuid-1", "openai");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.status).toBe("revoked");
      }
      expect(mockSecrets.deleteSecret).toHaveBeenCalledWith(
        "/axel-saas/users/user-uuid-1/integrations/openai/credential",
      );
      expect(mockRepo.markRevoked).toHaveBeenCalledWith("int-uuid-1");
    });

    it("returns error for non-existent integration", async () => {
      mockRepo.findByUserAndIntegration.mockResolvedValue(null);

      const result = await service.revoke("user-uuid-1", "openai");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Integration not found");
      }
      expect(mockSecrets.deleteSecret).not.toHaveBeenCalled();
    });

    it("returns error for already-revoked integration", async () => {
      mockRepo.findByUserAndIntegration.mockResolvedValue(
        makeRow({ status: "revoked" }),
      );

      const result = await service.revoke("user-uuid-1", "openai");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Integration already revoked");
      }
      expect(mockSecrets.deleteSecret).not.toHaveBeenCalled();
    });

    it("revoke then reconnect succeeds (no pending-deletion conflict)", async () => {
      // First revoke
      mockRepo.findByUserAndIntegration.mockResolvedValue(makeRow());
      const revokeResult = await service.revoke("user-uuid-1", "openai");
      expect(revokeResult.success).toBe(true);

      // Reconnect should work because ForceDeleteWithoutRecovery=true
      // means no recovery window blocking CreateSecret/PutSecretValue
      mockRepo.findByUserAndIntegration.mockResolvedValue(null);
      const connectResult = await service.connect(
        "user-uuid-1",
        "openai",
        "sk-new-key-12345678",
      );
      expect(connectResult.success).toBe(true);
      expect(mockSecrets.putSecret).toHaveBeenCalledWith(
        "/axel-saas/users/user-uuid-1/integrations/openai/credential",
        "sk-new-key-12345678",
      );
    });

    it("marks revoked in DB after secret deletion", async () => {
      mockRepo.findByUserAndIntegration.mockResolvedValue(makeRow());

      await service.revoke("user-uuid-1", "openai");

      // deleteSecret must be called before markRevoked
      const deleteOrder = (mockSecrets.deleteSecret as ReturnType<typeof vi.fn>)
        .mock.invocationCallOrder[0]!;
      const markOrder = mockRepo.markRevoked.mock.invocationCallOrder[0]!;
      expect(deleteOrder).toBeLessThan(markOrder);
    });
  });

  describe("secret safety invariants", () => {
    it("connect response never contains raw credential", async () => {
      const credential = "sk-super-secret-key-12345678";
      const result = await service.connect("user-uuid-1", "openai", credential);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain(credential);
      expect(serialized).not.toContain("sk-super-secret");
    });

    it("list response never contains secretPath", async () => {
      mockRepo.listByUserId.mockResolvedValue([
        {
          id: "int-1",
          integrationId: "openai",
          status: "connected",
          keyHint: "...5678",
        },
      ]);

      const results = await service.list("user-uuid-1");
      const serialized = JSON.stringify(results);
      expect(serialized).not.toContain("/axel-saas/users/");
      expect(serialized).not.toContain("secretPath");
    });
  });
});
