/**
 * `POST /api/reload` — workspace config reload.
 *
 * **MVP scope (this PR):** acknowledge the reload request and return
 * `202 deferred` so the backend's `triggerReload()` from PR #98 can
 * fire-and-forget without retrying. Actual reload semantics — re-read
 * `TOOLS.md`, `MEMORY.md`, etc. on the running agent — depend on
 * OpenClaw's plugin runtime reload hooks (`api.registerReload(...)`
 * in the plugin SDK), which are wired in `feat/workspace-config-sync`
 * (the next PR). Per the gateway-contract spec
 * (`specs/gateway-contract/design.md` §3 → "Reload is best-effort.
 * If the container doesn't support /api/reload, the fallback is that
 * OpenClaw reads workspace files on each new session/heartbeat") this
 * deferred-acknowledgement is a valid intermediate state.
 *
 * Backend behaviour:
 *   - 202 → backend logs and moves on (no retry)
 *   - missing endpoint (404) → backend's existing fallback path —
 *     also fine, but 202 is preferred so the backend knows the
 *     container *received* the request even if it can't act on it
 *     yet.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { readJsonBody, writeJson } from "./httpHelpers";

interface ReloadRequestBody {
  reason?: string;
  files?: string[];
}

export function makeReloadRouteHandler() {
  return async function reloadRouteHandler(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (req.method !== "POST") {
      writeJson(res, 405, {
        error: "method_not_allowed",
        message: "POST required",
      });
      return;
    }

    const bodyResult = await readJsonBody(req);
    if (bodyResult.kind === "too_large") {
      writeJson(res, 413, {
        error: "payload_too_large",
        message: `body exceeds ${bodyResult.limit} bytes`,
      });
      return;
    }
    if (bodyResult.kind === "invalid_json") {
      writeJson(res, 400, {
        error: "invalid_json",
        message: bodyResult.message,
      });
      return;
    }
    if (bodyResult.kind === "stream_error") {
      writeJson(res, 400, {
        error: "stream_error",
        message: bodyResult.message,
      });
      return;
    }

    const body = (bodyResult.body ?? {}) as ReloadRequestBody;

    // 202 Deferred — explicit "received but not yet applied". Once
    // workspace-config-sync wires `api.registerReload(...)` we'll
    // trigger an actual reload here and return 200 with
    // `{status:"reloaded", filesReloaded}` per the spec.
    writeJson(res, 202, {
      status: "deferred",
      message:
        "Reload request received. Workspace files will refresh on the next agent session/heartbeat. Active reload wiring is in feat/workspace-config-sync.",
      receivedReason: body.reason ?? null,
      receivedFiles: Array.isArray(body.files) ? body.files : [],
    });
  };
}
