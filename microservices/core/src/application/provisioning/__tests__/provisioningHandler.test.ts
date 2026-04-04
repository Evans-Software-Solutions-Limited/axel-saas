import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before vi.mock factories, making these available in the factory closures
const { mockFindByUserId, mockActivateGateway } = vi.hoisted(() => ({
  mockFindByUserId: vi.fn(),
  mockActivateGateway: vi.fn(),
}));

// Mock db before any imports that reach @axel-saas/db
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  provisioningStatusEnum: {
    enumValues: [
      "pending",
      "workspace_ready",
      "provisioning",
      "active",
      "failed",
      "deprovisioned",
    ],
  },
}));

vi.mock("../../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn(() => ({
    findByUserId: mockFindByUserId,
    activateGateway: mockActivateGateway,
  })),
}));

// Import after mocks are registered
import { provisioningHandler } from "../provisioningHandler";

const VALID_BODY = JSON.stringify({
  userId: "user-1",
  gatewayUrl: "https://gateway.example.com",
});

function makeRequest(
  body: string,
  extraHeaders: Record<string, string> = {},
): Request {
  return new Request("http://localhost/provisioning/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body,
  });
}

describe("provisioningHandler POST /provisioning/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("auth checks", () => {
    it("returns 503 when PROVISIONING_SECRET is unset and NODE_ENV=production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const res = await provisioningHandler.handle(makeRequest(VALID_BODY));
      expect(res.status).toBe(503);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.success).toBe(false);
      expect(data.error).toMatch(/not configured/i);
    });

    it("skips secret check when PROVISIONING_SECRET is unset and NODE_ENV is not production", async () => {
      vi.stubEnv("NODE_ENV", "development");
      mockFindByUserId.mockResolvedValue({ id: "prov-1", userId: "user-1" });
      mockActivateGateway.mockResolvedValue(undefined);

      // No secret header — should still reach business logic and succeed
      const res = await provisioningHandler.handle(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.success).toBe(true);
    });

    it("returns 401 when X-Provisioning-Secret header is absent", async () => {
      vi.stubEnv("PROVISIONING_SECRET", "correct-secret");
      const res = await provisioningHandler.handle(makeRequest(VALID_BODY));
      expect(res.status).toBe(401);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.success).toBe(false);
    });

    it("returns 401 when X-Provisioning-Secret header is wrong", async () => {
      vi.stubEnv("PROVISIONING_SECRET", "correct-secret");
      const res = await provisioningHandler.handle(
        makeRequest(VALID_BODY, { "x-provisioning-secret": "wrong" }),
      );
      expect(res.status).toBe(401);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.success).toBe(false);
    });
  });

  describe("body validation", () => {
    it("returns 422 when gatewayUrl is missing", async () => {
      vi.stubEnv("PROVISIONING_SECRET", "s3cr3t");
      const res = await provisioningHandler.handle(
        makeRequest(JSON.stringify({ userId: "user-1" }), {
          "x-provisioning-secret": "s3cr3t",
        }),
      );
      expect(res.status).toBe(422);
    });

    it("returns 422 when userId is missing", async () => {
      vi.stubEnv("PROVISIONING_SECRET", "s3cr3t");
      const res = await provisioningHandler.handle(
        makeRequest(
          JSON.stringify({ gatewayUrl: "https://gateway.example.com" }),
          { "x-provisioning-secret": "s3cr3t" },
        ),
      );
      expect(res.status).toBe(422);
    });
  });

  describe("business logic", () => {
    beforeEach(() => {
      vi.stubEnv("PROVISIONING_SECRET", "s3cr3t");
    });

    it("returns 404 when no provisioning state exists for the user", async () => {
      mockFindByUserId.mockResolvedValue(null);

      const res = await provisioningHandler.handle(
        makeRequest(VALID_BODY, { "x-provisioning-secret": "s3cr3t" }),
      );
      expect(res.status).toBe(404);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.success).toBe(false);
    });

    it("activates the gateway and returns 200 on success", async () => {
      mockFindByUserId.mockResolvedValue({ id: "prov-1", userId: "user-1" });
      mockActivateGateway.mockResolvedValue(undefined);

      const res = await provisioningHandler.handle(
        makeRequest(VALID_BODY, { "x-provisioning-secret": "s3cr3t" }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, unknown>;
      expect(data.success).toBe(true);
      expect(data.userId).toBe("user-1");
      expect(mockActivateGateway).toHaveBeenCalledWith(
        "user-1",
        "https://gateway.example.com",
      );
    });
  });
});
