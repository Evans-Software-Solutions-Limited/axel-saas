import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  triggerContainerLaunch,
  resolveWorkspacePath,
} from "../provisioningService";
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
  tier: "premium",
  workspacePath: "/tmp/workspace/user-id-1/workspace",
};

// Reset fetch mock between tests
beforeEach(() => {
  vi.unstubAllEnvs();
  global.fetch = vi.fn();
});

describe("resolveWorkspacePath", () => {
  it("uses /tmp/workspace root when WORKSPACE_PATH is not set", () => {
    expect(resolveWorkspacePath("user-abc")).toBe(
      "/tmp/workspace/user-abc/workspace",
    );
  });

  it("uses WORKSPACE_PATH env var as root when set", () => {
    vi.stubEnv("WORKSPACE_PATH", "/mnt/efs");
    expect(resolveWorkspacePath("user-abc")).toBe(
      "/mnt/efs/user-abc/workspace",
    );
  });

  it("produces the same path for the same userId regardless of call site", () => {
    vi.stubEnv("WORKSPACE_PATH", "/mnt/efs");
    const userId = "user-123";
    expect(resolveWorkspacePath(userId)).toBe(resolveWorkspacePath(userId));
  });
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
    it("advances provisioning_state status to 'provisioning' when webhook URL is set", async () => {
      vi.stubEnv(
        "PROVISIONING_WEBHOOK_URL",
        "https://provisioner.internal/launch",
      );
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await triggerContainerLaunch(repo, PARAMS);

      expect(repo.updateStatus).toHaveBeenCalledWith(
        "prov-id-1",
        "provisioning",
      );
    });

    it("does NOT advance status when PROVISIONING_WEBHOOK_URL is unset (dev no-webhook mode)", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      await triggerContainerLaunch(repo, PARAMS);

      // Status must remain "pending" — never gets stuck at "provisioning"
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it("no-ops when status is already 'failed' (replay safety — retry requires explicit admin action)", async () => {
      // A replayed Stripe webhook must not automatically retry a failed launch.
      // The "failed" state is terminal for webhook replay purposes.
      const failedProv = {
        ...PROV,
        status: "failed" as const,
        errorMessage: "Webhook fetch error: ECONNREFUSED",
      };
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(failedProv),
      });

      await expect(
        triggerContainerLaunch(repo, PARAMS),
      ).resolves.toBeUndefined();

      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("no-ops when status is active AND gatewayUrl is set (container running — replay safety)", async () => {
      // gatewayUrl is set by activateGateway when the container registers itself.
      // A replayed webhook must not re-fire the orchestrator.
      const activeProv = {
        ...PROV,
        status: "active" as const,
        gatewayUrl: "https://container.internal/gw",
      };
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(activeProv),
      });

      await expect(
        triggerContainerLaunch(repo, PARAMS),
      ).resolves.toBeUndefined();

      expect(repo.updateStatus).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("triggers launch when status is active but gatewayUrl is null (onboarding completed before Stripe webhook)", async () => {
      // Race: onboarding called updateProvisioned() which sets status="active"
      // but no container has registered yet (gatewayUrl is null).
      // The Stripe checkout.session.completed webhook must still launch the container.
      vi.stubEnv(
        "PROVISIONING_WEBHOOK_URL",
        "https://provisioner.internal/launch",
      );
      const onboardingActiveProv = {
        ...PROV,
        status: "active" as const,
        gatewayUrl: null,
      };
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(onboardingActiveProv),
      });
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      await expect(
        triggerContainerLaunch(repo, PARAMS),
      ).resolves.toBeUndefined();

      // Status must have advanced to "provisioning" (webhook was fired)
      expect(repo.updateStatus).toHaveBeenCalledWith(
        "prov-id-1",
        "provisioning",
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://provisioner.internal/launch",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("when PROVISIONING_WEBHOOK_URL is not set", () => {
    it("no-ops without calling fetch or mutating status", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      await triggerContainerLaunch(repo, PARAMS);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(repo.updateStatus).not.toHaveBeenCalled();
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

    it("marks provisioning as failed and rethrows on transport-level fetch error", async () => {
      const repo = makeRepo({
        findByUserId: vi.fn().mockResolvedValue(PROV),
      });

      const networkErr = new Error("ECONNREFUSED");
      global.fetch = vi.fn().mockRejectedValue(networkErr);

      await expect(triggerContainerLaunch(repo, PARAMS)).rejects.toThrow(
        "ECONNREFUSED",
      );

      expect(repo.updateStatus).toHaveBeenCalledWith(
        "prov-id-1",
        "failed",
        expect.stringContaining("ECONNREFUSED"),
      );
    });
  });
});
