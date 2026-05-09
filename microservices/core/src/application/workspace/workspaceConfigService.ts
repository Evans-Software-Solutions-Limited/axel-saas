/**
 * WorkspaceConfigService — single mechanism for writing post-onboarding
 * config changes into a user's OpenClaw workspace and signalling the
 * running container to re-read them.
 *
 * Spec: `specs/workspace-config-sync/design.md`. Companion to PR #98's
 * `gatewayClient.ts` (the typed `triggerReload` call) and PR #99's
 * `axel-bridge` plugin (the `/api/reload` route inside the container).
 *
 * Scope (this PR — the brief's "scope A"): the service itself + the
 * minimal hooks for integration connect/revoke and BYOM key change.
 * Schedule changes (`HEARTBEAT.md`), tier changes (`SOUL.md` /
 * `AGENTS.md`), and `openclaw.json` regeneration are deliberate
 * deferrals — see the PR description for why.
 *
 * Failure-tolerance contract:
 *   - **EFS write fails** — log and propagate (caller decides whether
 *     to surface the error to the user; integration handlers want the
 *     surface, BYOM might not).
 *   - **Container offline** (no provisioning row, status !== "active",
 *     or null gateway URL) — write the file anyway, skip the reload.
 *     OpenClaw will read the new file on its next startup.
 *   - **Reload call fails (timeout/network/4xx/5xx)** — log and
 *     swallow. The spec calls reload "best-effort" with the fallback
 *     being "OpenClaw reads files on the next heartbeat (2-4x/day)".
 *     A user-facing error here would be misleading — the change *did*
 *     land in the file system.
 */

import { promises as fs } from "fs";
import path from "path";
import {
  triggerReload as defaultTriggerReload,
  type GatewayResult,
  type ReloadResponseBody,
} from "../gateway/gatewayClient";
import { resolveWorkspacePath as defaultResolveWorkspacePath } from "../provisioning/provisioningService";
import type { ProvisioningRepository } from "../repositories/provisioningRepository";

/** A single file's intended new content. Writes are full-replacement, not patches. */
export interface FileUpdate {
  /** Filename within the workspace, e.g. "TOOLS.md" or "openclaw.json". */
  filename: string;
  /** Full UTF-8 content to write. */
  content: string;
}

/**
 * Reason codes — match the gateway-contract spec's `reason` values
 * verbatim so the bridge plugin's `/api/reload` echoes them back to
 * the backend's logs unchanged. New values should be added to this
 * union AND to the spec's table at the same time.
 */
export type UpdateReason =
  | "integration_changed"
  | "byom_changed"
  | "schedule_changed"
  | "tier_changed"
  | "onboarding_complete";

export interface WorkspaceConfigServiceDeps {
  provisioningRepo: ProvisioningRepository;
  /** Override for tests + alternative reload transports. */
  triggerReload?: typeof defaultTriggerReload;
  /** Override for tests; the function shape matches `provisioningService.resolveWorkspacePath`. */
  resolveWorkspacePath?: (userId: string) => string;
  /**
   * Resolve the gateway bearer token at call time. Default reads
   * `OPENCLAW_GATEWAY_TOKEN` from `process.env`. Returns `null` when
   * unset — the reload call then proceeds without an Authorization
   * header (the bridge plugin will 401 it; that's a logged
   * fire-and-forget failure, not a crash).
   *
   * Per-user gateway tokens — once `provisioning_state` grows a
   * `gateway_token` column — would slot in here without changing
   * any caller.
   */
  resolveGatewayAuthorization?: () => string | null;
  /** Filesystem driver — overridable for tests so they don't touch real disk. */
  fs?: WorkspaceConfigFs;
  /** Plug-point logger. Defaults to a no-op so production doesn't spam tests. */
  logger?: WorkspaceConfigLogger;
}

export interface WorkspaceConfigFs {
  mkdir: (target: string, options: { recursive: true }) => Promise<unknown>;
  writeFile: (
    target: string,
    content: string,
    encoding: BufferEncoding,
  ) => Promise<void>;
}

export interface WorkspaceConfigLogger {
  info: (message: string, ctx?: Record<string, unknown>) => void;
  warn: (message: string, ctx?: Record<string, unknown>) => void;
  error: (message: string, ctx?: Record<string, unknown>) => void;
}

const noopLogger: WorkspaceConfigLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

const RELOAD_TIMEOUT_MS = 10_000;

export class WorkspaceConfigService {
  private readonly provisioningRepo: ProvisioningRepository;
  private readonly triggerReload: typeof defaultTriggerReload;
  private readonly resolveWorkspacePath: (userId: string) => string;
  private readonly resolveGatewayAuthorization: () => string | null;
  private readonly fs: WorkspaceConfigFs;
  private readonly logger: WorkspaceConfigLogger;

  constructor(deps: WorkspaceConfigServiceDeps) {
    this.provisioningRepo = deps.provisioningRepo;
    this.triggerReload = deps.triggerReload ?? defaultTriggerReload;
    this.resolveWorkspacePath =
      deps.resolveWorkspacePath ?? defaultResolveWorkspacePath;
    this.resolveGatewayAuthorization =
      deps.resolveGatewayAuthorization ?? defaultResolveGatewayAuthorization;
    this.fs = deps.fs ?? defaultFs;
    this.logger = deps.logger ?? noopLogger;
  }

  /**
   * Write `updates` to the user's workspace and trigger a reload on
   * the running container.
   *
   * Resolves on success of the *write* (the reload is fire-and-forget
   * — see class doc). Throws if the write fails so callers can
   * surface "we couldn't save this" to the user where it matters.
   */
  async updateFiles(
    userId: string,
    updates: readonly FileUpdate[],
    reason: UpdateReason,
  ): Promise<void> {
    if (updates.length === 0) {
      // Empty update sets are valid no-ops (lets callers compose
      // updates conditionally without branching at the call site).
      return;
    }

    const workspacePath = this.resolveWorkspacePath(userId);

    try {
      await this.fs.mkdir(workspacePath, { recursive: true });
      await Promise.all(
        updates.map(({ filename, content }) =>
          this.fs.writeFile(
            path.join(workspacePath, filename),
            content,
            "utf8",
          ),
        ),
      );
    } catch (err: unknown) {
      this.logger.error("workspace-config: write failed", {
        userId,
        reason,
        filenames: updates.map((u) => u.filename),
        error: errorMessage(err),
      });
      throw err;
    }

    this.logger.info("workspace-config: files written", {
      userId,
      reason,
      filenames: updates.map((u) => u.filename),
    });

    // Reload signal — fire-and-forget. Look up the container, skip
    // when it isn't reachable (logs `skipped` so traces still tell
    // the story), otherwise call and log the result.
    await this.signalReload(userId, updates, reason).catch((err: unknown) => {
      this.logger.error("workspace-config: reload signal threw", {
        userId,
        reason,
        error: errorMessage(err),
      });
    });
  }

  private async signalReload(
    userId: string,
    updates: readonly FileUpdate[],
    reason: UpdateReason,
  ): Promise<void> {
    const container = await this.provisioningRepo.getContainerByUserId(userId);
    if (!container || container.status !== "active" || !container.gatewayUrl) {
      this.logger.info(
        "workspace-config: reload skipped (no active container)",
        {
          userId,
          reason,
          hasContainer: !!container,
          status: container?.status ?? null,
        },
      );
      return;
    }

    const result: GatewayResult<ReloadResponseBody> = await this.triggerReload({
      rawGatewayUrl: container.gatewayUrl,
      reason,
      files: updates.map((u) => u.filename),
      authorization: this.resolveGatewayAuthorization() ?? null,
      timeoutMs: RELOAD_TIMEOUT_MS,
    });

    switch (result.kind) {
      case "ok":
        this.logger.info("workspace-config: reload acknowledged", {
          userId,
          reason,
          status: result.body.status ?? null,
        });
        return;
      case "rate_limited":
        this.logger.warn("workspace-config: reload rate-limited", {
          userId,
          reason,
          retryAfter: result.retryAfter,
        });
        return;
      case "error":
        this.logger.warn("workspace-config: reload returned non-2xx", {
          userId,
          reason,
          status: result.status,
          message: result.message,
        });
        return;
      case "timeout":
        this.logger.warn("workspace-config: reload timed out", {
          userId,
          reason,
        });
        return;
      case "network_error":
        this.logger.warn("workspace-config: reload network error", {
          userId,
          reason,
          message: result.message,
        });
        return;
      case "invalid_url":
        this.logger.warn("workspace-config: reload skipped (invalid URL)", {
          userId,
          reason,
          gatewayUrl: container.gatewayUrl,
        });
        return;
    }
  }
}

const defaultFs: WorkspaceConfigFs = {
  mkdir: (target, opts) => fs.mkdir(target, opts),
  writeFile: (target, content, encoding) =>
    fs.writeFile(target, content, encoding),
};

function defaultResolveGatewayAuthorization(): string | null {
  const token = process.env.OPENCLAW_GATEWAY_TOKEN;
  return token && token.length > 0 ? `Bearer ${token}` : null;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
