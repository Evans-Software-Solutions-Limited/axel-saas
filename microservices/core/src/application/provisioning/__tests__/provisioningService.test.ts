import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerContainerLaunch } from "../provisioningService";
import type { ProvisioningRepository } from "../../repositories/provisioningRepository";

// Minimal mock of ProvisioningRepository
function makeRepo(overrides: Partial<ProvisioningRepository> = {}) {
  return {
    findByUserId: vi.fn(),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    activateGateway: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    updateTaskArn: vi.fn(),
    updateProvisioned: vi.fn(),
    updateGatewayUrl: vi.fn(),
    getContainerByUserId: vi.fn(),
    ...overrides,
  } as unknown as ProvisioningRepository;
}

const PROV = {
  id: "prov-id-1",
  userId: "user-id-1",
  status: "pending" as const,
  ecsTaskArn: null,
  workspacePath: null,
  gatewayUrl: null,
  errorMessage: null,
  provisionedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const PARAMS = {
  userId: "user-id-1",
  tier: "pro",
  workspacePath: "/tmp/workspace/user-id-1/workspace",
};

// Reset fetch mock between tests
beforeEach(() => {
  vi.unstubAllEnvs();
  global.fetch = vi.fn();
});

describe("triggerContainerLaunch", () => {
  describe("when provisioning state is missing", () => {
    it("throws an error if no provisioning state exists for user", async () => {
      const repo = makeRepo({ findByUserId: vi.fn().mockResolvedValue(null) });

      await expect(triggerContainerLaunch(repo, PARAMS)).rejects.toThrow(
        "No provisioning state found for user user-id-1",
      );
    });
  });

  describe("status progression", () => {
    it("advances provisioning_state status to 'provisioning'", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      // No webhook URL set — no-op after status update
      await triggerContainerLaunch(repo, PARAMS);

      expect(repo.updateStatus).toHaveBeenCalledWith(
        "prov-id-1",
        "provisioning",
      );
    });
  });

  describe("when PROVISIONING_WEBHOOK_URL is not set", () => {
    it("no-ops without calling fetch", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      await triggerContainerLaunch(repo, PARAMS);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("resolves successfully", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      await expect(
        triggerContainerLaunch(repo, PARAMS),
      ).resolves.toBeUndefined();
    });
  });

  describe("when PROVISIONING_WEBHOOK_URL is set", () => {
    beforeEach(() => {
      vi.stubEnv(
        "PROVISIONING_WEBHOOK_URL",
        "https://provisioner.internal/launch",
      );
    });

    it("sends POST to the webhook URL with correct payload", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await triggerContainerLaunch(repo, PARAMS);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://provisioner.internal/launch",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(PARAMS),
        }),
      );
    });

    it("includes X-Provisioning-Secret header when secret is set", async () => {
      vi.stubEnv("PROVISIONING_WEBHOOK_SECRET", "super-secret");

      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await triggerContainerLaunch(repo, PARAMS);

      const [, fetchOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(
        (fetchOptions.headers as Record<string, string>)[
          "X-Provisioning-Secret"
        ],
      ).toBe("super-secret");
    });

    it("omits X-Provisioning-Secret header when secret is not set", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await triggerContainerLaunch(repo, PARAMS);

      const [, fetchOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(
        (fetchOptions.headers as Record<string, string>)[
          "X-Provisioning-Secret"
        ],
      ).toBeUndefined();
    });

    it("marks provisioning as failed and throws on non-OK webhook response", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("Service unavailable"),
      });

      await expect(triggerContainerLaunch(repo, PARAMS)).rejects.toThrow(
        "Provisioning webhook returned 503",
      );

      expect(repo.updateStatus).toHaveBeenCalledWith(
        "prov-id-1",
        "failed",
        expect.stringContaining("503"),
      );
    });

    it("handles webhook error text fetch failure gracefully", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockRejectedValue(new Error("Cannot read body")),
      });

      await expect(triggerContainerLaunch(repo, PARAMS)).rejects.toThrow(
        "Provisioning webhook returned 500: unknown error",
      );
    });
  });
});
