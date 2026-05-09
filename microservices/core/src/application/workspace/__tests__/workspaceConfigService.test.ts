/**
 * Tests for `WorkspaceConfigService`. Mocks the FS, gateway client,
 * and provisioning repo so tests run hermetically (no real disk, no
 * real network, no real DB). One smoke test below uses a real tmp
 * directory to exercise the `defaultFs` pass-through.
 */
import { promises as realFs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WorkspaceConfigService,
  type WorkspaceConfigFs,
  type WorkspaceConfigLogger,
} from "../workspaceConfigService";
import type { GatewayResult } from "../../gateway/gatewayClient";
import type { ProvisioningRepository } from "../../repositories/provisioningRepository";

const ACTIVE_CONTAINER = {
  taskArn: "arn:aws:ecs:eu-west-2:123:task/abc",
  status: "active" as const,
  gatewayUrl: "https://test.openclaw.staging.meetaxel.ai",
  workspacePath: "/efs/u-1/workspace",
};

function makeFakeFs(): WorkspaceConfigFs & {
  mkdir: ReturnType<typeof vi.fn>;
  writeFile: ReturnType<typeof vi.fn>;
} {
  return {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
}

function makeFakeLogger(): WorkspaceConfigLogger & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function makeFakeProvisioningRepo(
  container: typeof ACTIVE_CONTAINER | null,
): Pick<ProvisioningRepository, "getContainerByUserId"> {
  return {
    getContainerByUserId: vi.fn().mockResolvedValue(container),
  } as unknown as Pick<ProvisioningRepository, "getContainerByUserId">;
}

const okReload = (): GatewayResult<{ status: "reloaded" }> => ({
  kind: "ok",
  body: { status: "reloaded" },
});

describe("WorkspaceConfigService.updateFiles", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.OPENCLAW_GATEWAY_TOKEN;
    process.env.OPENCLAW_GATEWAY_TOKEN = "test-token";
  });
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPENCLAW_GATEWAY_TOKEN;
    } else {
      process.env.OPENCLAW_GATEWAY_TOKEN = originalEnv;
    }
  });

  it("writes each update to the resolved workspace path and signals reload", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn().mockResolvedValue(okReload());
    const provisioningRepo = makeFakeProvisioningRepo(ACTIVE_CONTAINER);

    const svc = new WorkspaceConfigService({
      provisioningRepo: provisioningRepo as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
    });

    await svc.updateFiles(
      "u-1",
      [
        { filename: "TOOLS.md", content: "tools body" },
        { filename: "openclaw.json", content: "{}" },
      ],
      "integration_changed",
    );

    expect(fs.mkdir).toHaveBeenCalledWith("/efs/u-1/workspace", {
      recursive: true,
    });
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
    expect(fs.writeFile).toHaveBeenCalledWith(
      "/efs/u-1/workspace/TOOLS.md",
      "tools body",
      "utf8",
    );
    expect(fs.writeFile).toHaveBeenCalledWith(
      "/efs/u-1/workspace/openclaw.json",
      "{}",
      "utf8",
    );

    expect(triggerReload).toHaveBeenCalledOnce();
    const reloadArgs = triggerReload.mock.calls[0]![0];
    expect(reloadArgs.rawGatewayUrl).toBe(ACTIVE_CONTAINER.gatewayUrl);
    expect(reloadArgs.reason).toBe("integration_changed");
    expect(reloadArgs.files).toEqual(["TOOLS.md", "openclaw.json"]);
    expect(reloadArgs.authorization).toBe("Bearer test-token");
  });

  it("no-ops cleanly on an empty update set", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn().mockResolvedValue(okReload());

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo(
        ACTIVE_CONTAINER,
      ) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
    });

    await svc.updateFiles("u-1", [], "integration_changed");

    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(triggerReload).not.toHaveBeenCalled();
  });

  it("throws (and logs) when the EFS write fails", async () => {
    const fs = makeFakeFs();
    fs.writeFile.mockRejectedValue(new Error("EROFS"));
    const triggerReload = vi.fn();
    const logger = makeFakeLogger();

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo(
        ACTIVE_CONTAINER,
      ) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
      logger,
    });

    await expect(
      svc.updateFiles(
        "u-1",
        [{ filename: "TOOLS.md", content: "x" }],
        "integration_changed",
      ),
    ).rejects.toThrow(/EROFS/);

    expect(triggerReload).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "workspace-config: write failed",
      expect.objectContaining({ userId: "u-1" }),
    );
  });

  it("skips reload when the container row is missing", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn();
    const logger = makeFakeLogger();

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo(
        null,
      ) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
      logger,
    });

    await svc.updateFiles(
      "u-1",
      [{ filename: "TOOLS.md", content: "x" }],
      "integration_changed",
    );

    expect(fs.writeFile).toHaveBeenCalledOnce();
    expect(triggerReload).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "workspace-config: reload skipped (no active container)",
      expect.objectContaining({ userId: "u-1", hasContainer: false }),
    );
  });

  it("skips reload when status is not active", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn();

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo({
        ...ACTIVE_CONTAINER,
        status: "pending" as never,
      }) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
    });

    await svc.updateFiles(
      "u-1",
      [{ filename: "TOOLS.md", content: "x" }],
      "integration_changed",
    );

    expect(triggerReload).not.toHaveBeenCalled();
  });

  it("skips reload when gatewayUrl is null", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn();

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo({
        ...ACTIVE_CONTAINER,
        gatewayUrl: null as unknown as string,
      }) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
    });

    await svc.updateFiles(
      "u-1",
      [{ filename: "TOOLS.md", content: "x" }],
      "integration_changed",
    );

    expect(triggerReload).not.toHaveBeenCalled();
  });

  it("logs each non-ok reload result variant without throwing", async () => {
    type Result = GatewayResult<{ status: "reloaded" }>;
    const variants: Result[] = [
      { kind: "rate_limited", retryAfter: 5 },
      { kind: "error", status: 500, message: "boom" },
      { kind: "timeout" },
      { kind: "network_error", message: "ECONNREFUSED" },
      { kind: "invalid_url" },
    ];
    for (const variant of variants) {
      const fs = makeFakeFs();
      const triggerReload = vi.fn().mockResolvedValue(variant);
      const logger = makeFakeLogger();

      const svc = new WorkspaceConfigService({
        provisioningRepo: makeFakeProvisioningRepo(
          ACTIVE_CONTAINER,
        ) as ProvisioningRepository,
        triggerReload,
        resolveWorkspacePath: () => "/efs/u-1/workspace",
        fs,
        logger,
      });

      await expect(
        svc.updateFiles(
          "u-1",
          [{ filename: "TOOLS.md", content: "x" }],
          "integration_changed",
        ),
      ).resolves.toBeUndefined();

      expect(triggerReload).toHaveBeenCalledOnce();
      // Either warn or info gets called (ok would be info; everything
      // else is warn). At minimum, *something* is logged for traces.
      const totalLogs =
        logger.info.mock.calls.length +
        logger.warn.mock.calls.length +
        logger.error.mock.calls.length;
      expect(totalLogs).toBeGreaterThan(0);
    }
  });

  it("catches a thrown reload (and keeps the file write success)", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn().mockRejectedValue(new Error("synthetic"));
    const logger = makeFakeLogger();

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo(
        ACTIVE_CONTAINER,
      ) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
      logger,
    });

    await expect(
      svc.updateFiles(
        "u-1",
        [{ filename: "TOOLS.md", content: "x" }],
        "integration_changed",
      ),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      "workspace-config: reload signal threw",
      expect.objectContaining({ userId: "u-1" }),
    );
  });

  it("falls back to no Authorization header when the env var is unset", async () => {
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    const fs = makeFakeFs();
    const triggerReload = vi.fn().mockResolvedValue(okReload());

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo(
        ACTIVE_CONTAINER,
      ) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      fs,
    });

    await svc.updateFiles(
      "u-1",
      [{ filename: "TOOLS.md", content: "x" }],
      "integration_changed",
    );

    expect(triggerReload.mock.calls[0]![0].authorization).toBeNull();
  });

  it("smoke: writes through the default fs (no fs override)", async () => {
    const triggerReload = vi.fn().mockResolvedValue(okReload());
    const tempRoot = await realFs.mkdtemp(
      path.join(tmpdir(), "workspace-config-svc-"),
    );
    try {
      const svc = new WorkspaceConfigService({
        provisioningRepo: makeFakeProvisioningRepo(
          ACTIVE_CONTAINER,
        ) as ProvisioningRepository,
        triggerReload,
        resolveWorkspacePath: () => tempRoot,
      });
      await svc.updateFiles(
        "u-real-fs",
        [{ filename: "TOOLS.md", content: "real fs body" }],
        "integration_changed",
      );
      const written = await realFs.readFile(
        path.join(tempRoot, "TOOLS.md"),
        "utf8",
      );
      expect(written).toBe("real fs body");
    } finally {
      await realFs.rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("uses an injected gateway-authorization resolver in preference to env", async () => {
    const fs = makeFakeFs();
    const triggerReload = vi.fn().mockResolvedValue(okReload());

    const svc = new WorkspaceConfigService({
      provisioningRepo: makeFakeProvisioningRepo(
        ACTIVE_CONTAINER,
      ) as ProvisioningRepository,
      triggerReload,
      resolveWorkspacePath: () => "/efs/u-1/workspace",
      resolveGatewayAuthorization: () => "Bearer per-user-token",
      fs,
    });

    await svc.updateFiles(
      "u-1",
      [{ filename: "TOOLS.md", content: "x" }],
      "integration_changed",
    );

    expect(triggerReload.mock.calls[0]![0].authorization).toBe(
      "Bearer per-user-token",
    );
  });
});
