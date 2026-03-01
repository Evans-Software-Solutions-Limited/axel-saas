import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Db } from "@axel-saas/db";

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

const mockProvisioningRow = {
  id: "prov-uuid-1",
  userId: "user-uuid-1",
  status: "pending" as const,
  ecsTaskArn: null,
  workspacePath: null,
  gatewayToken: null,
  errorMessage: null,
  provisionedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe("ProvisioningRepository", () => {
  let mockDb: Partial<Db>;
  let ProvisioningRepository: typeof import("../provisioningRepository").ProvisioningRepository;

  beforeEach(async () => {
    mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;

    // Import the class normally for direct class tests
    const module = await import("../provisioningRepository");
    ProvisioningRepository = module.ProvisioningRepository;
  });

  let repo: InstanceType<typeof ProvisioningRepository>;

  beforeEach(() => {
    repo = new ProvisioningRepository(mockDb as Db);
  });

  describe("create", () => {
    it("creates a new provisioning state", async () => {
      const prov = await repo.create({
        userId: "user-uuid-1",
        status: "pending",
      });

      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(prov.id).toBe("prov-uuid-1");
      expect(prov.status).toBe("pending");
    });

    it("throws if no row is returned", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      await expect(
        repo.create({
          userId: "user-uuid-1",
          status: "pending",
        }),
      ).rejects.toThrow("Failed to create provisioning state");
    });
  });

  describe("findByUserId", () => {
    it("returns provisioning state when found", async () => {
      const prov = await repo.findByUserId("user-uuid-1");
      expect(prov).not.toBeNull();
      expect(prov?.userId).toBe("user-uuid-1");
    });

    it("returns null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const prov = await repo.findByUserId("nonexistent");
      expect(prov).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("updates provisioning status", async () => {
      await repo.updateStatus("prov-uuid-1", "provisioning");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("updates status with error message", async () => {
      await repo.updateStatus("prov-uuid-1", "failed", "Provisioning failed");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateTaskArn", () => {
    it("updates ECS task ARN", async () => {
      await repo.updateTaskArn("prov-uuid-1", "arn:aws:ecs:...");
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateProvisioned", () => {
    it("updates to provisioned state", async () => {
      await repo.updateProvisioned(
        "prov-uuid-1",
        "/home/ubuntu/.openclaw/workspace/user-1",
      );
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });

  describe("updateGatewayToken", () => {
    it("updates gateway token", async () => {
      const token = "test-gateway-token-123";
      await repo.updateGatewayToken("prov-uuid-1", token);
      expect(mockDb.update).toHaveBeenCalledOnce();
    });
  });
});

describe("exported provisioningRepository wrapper (singleton)", () => {
  beforeEach(() => {
    // Clear any cached modules
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("provisioningRepository.findByUserId calls wrapper and returns function result", async () => {
    const mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    };

    vi.doMock("@axel-saas/db", () => ({
      getDb: vi.fn(() => mockDb),
      provisioningState: {},
      provisioningStatusEnum: { enumValues: ["pending", "provisioning", "active", "failed"] },
    }));

    const { provisioningRepository } = await import("../provisioningRepository");
    const result = await provisioningRepository.findByUserId("user-uuid-1");
    
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-uuid-1");
    expect(mockDb.select).toHaveBeenCalled();

    vi.doUnmock("@axel-saas/db");
  });

  it("provisioningRepository.create calls wrapper and creates row", async () => {
    const mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    };

    vi.doMock("@axel-saas/db", () => ({
      getDb: vi.fn(() => mockDb),
      provisioningState: {},
      provisioningStatusEnum: { enumValues: ["pending", "provisioning", "active", "failed"] },
    }));

    const { provisioningRepository } = await import("../provisioningRepository");
    const result = await provisioningRepository.create({
      userId: "user-uuid-1",
      status: "pending",
    });
    
    expect(result).not.toBeNull();
    expect(result.id).toBe("prov-uuid-1");
    expect(mockDb.insert).toHaveBeenCalled();

    vi.doUnmock("@axel-saas/db");
  });

  it("provisioningRepository.updateStatus calls wrapper", async () => {
    const mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    };

    vi.doMock("@axel-saas/db", () => ({
      getDb: vi.fn(() => mockDb),
      provisioningState: {},
      provisioningStatusEnum: { enumValues: ["pending", "provisioning", "active", "failed"] },
    }));

    const { provisioningRepository } = await import("../provisioningRepository");
    await provisioningRepository.updateStatus("prov-uuid-1", "provisioning");
    
    expect(mockDb.update).toHaveBeenCalled();

    vi.doUnmock("@axel-saas/db");
  });

  it("provisioningRepository.updateTaskArn calls wrapper", async () => {
    const mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    };

    vi.doMock("@axel-saas/db", () => ({
      getDb: vi.fn(() => mockDb),
      provisioningState: {},
      provisioningStatusEnum: { enumValues: ["pending", "provisioning", "active", "failed"] },
    }));

    const { provisioningRepository } = await import("../provisioningRepository");
    await provisioningRepository.updateTaskArn("prov-uuid-1", "arn:aws:ecs:task");
    
    expect(mockDb.update).toHaveBeenCalled();

    vi.doUnmock("@axel-saas/db");
  });

  it("provisioningRepository.updateProvisioned calls wrapper", async () => {
    const mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    };

    vi.doMock("@axel-saas/db", () => ({
      getDb: vi.fn(() => mockDb),
      provisioningState: {},
      provisioningStatusEnum: { enumValues: ["pending", "provisioning", "active", "failed"] },
    }));

    const { provisioningRepository } = await import("../provisioningRepository");
    await provisioningRepository.updateProvisioned("prov-uuid-1", "/workspace");
    
    expect(mockDb.update).toHaveBeenCalled();

    vi.doUnmock("@axel-saas/db");
  });

  it("provisioningRepository.updateGatewayToken calls wrapper", async () => {
    const mockDb = {
      insert: vi.fn(() => mockChain([mockProvisioningRow])),
      select: vi.fn(() => mockChain([mockProvisioningRow])),
      update: vi.fn(() => mockChain([])),
    };

    vi.doMock("@axel-saas/db", () => ({
      getDb: vi.fn(() => mockDb),
      provisioningState: {},
      provisioningStatusEnum: { enumValues: ["pending", "provisioning", "active", "failed"] },
    }));

    const { provisioningRepository } = await import("../provisioningRepository");
    await provisioningRepository.updateGatewayToken("prov-uuid-1", "token-xyz");
    
    expect(mockDb.update).toHaveBeenCalled();

    vi.doUnmock("@axel-saas/db");
  });
});
