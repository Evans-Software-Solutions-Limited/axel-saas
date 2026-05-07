/**
 * `GET /api/health` — gateway-contract health probe.
 *
 * Strategy: proxy OpenClaw's first-party `/healthz` (which we
 * confirmed via the post-#98 spike returns `{"ok":true,"status":"live"}`)
 * and reshape the response to the gateway-contract spec
 * (`specs/gateway-contract/design.md` §3 — `{status, agentReady,
 * uptime, lastActivity}`).
 *
 * On upstream failure we return `503 unhealthy` with a `reason` so the
 * Axel-side `checkHealth()` from PR #98 can pattern-match cleanly
 * instead of having to parse a 5xx body.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { writeJson } from "./httpHelpers";

export const TIMEOUT_HEALTH_MS = 5_000;

export interface HealthRouteConfig {
  chatCompletionsBaseUrl: string;
}

export interface HealthRouteDeps {
  fetcher?: typeof fetch;
  /** Process start time, in epoch millis. Defaults to module-load time. */
  startedAtMs?: number;
}

const PROCESS_START_MS = Date.now();

interface HealthzBody {
  ok?: boolean;
  status?: string;
}

export function makeHealthRouteHandler(
  config: HealthRouteConfig,
  deps: HealthRouteDeps = {},
) {
  const fetcher = deps.fetcher ?? globalThis.fetch;
  const startedAtMs = deps.startedAtMs ?? PROCESS_START_MS;

  return async function healthRouteHandler(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    if (req.method !== "GET") {
      writeJson(res, 405, {
        error: "method_not_allowed",
        message: "GET required",
      });
      return;
    }

    const url = new URL("/healthz", config.chatCompletionsBaseUrl).toString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_HEALTH_MS);

    try {
      const upstream = await fetcher(url, { signal: controller.signal });
      if (!upstream.ok) {
        writeJson(res, 503, {
          status: "unhealthy",
          agentReady: false,
          reason: `upstream /healthz returned ${upstream.status}`,
        });
        return;
      }
      const body = (await upstream.json()) as HealthzBody;
      const isLive = body.ok === true && body.status === "live";
      writeJson(res, isLive ? 200 : 503, {
        status: isLive ? "healthy" : "unhealthy",
        agentReady: isLive,
        uptime: Math.floor((Date.now() - startedAtMs) / 1000),
        ...(isLive
          ? {}
          : { reason: `unexpected /healthz body: ${JSON.stringify(body)}` }),
      });
    } catch (err: unknown) {
      const aborted = err instanceof Error && err.name === "AbortError";
      writeJson(res, 503, {
        status: "unhealthy",
        agentReady: false,
        reason: aborted
          ? `upstream /healthz timed out after ${TIMEOUT_HEALTH_MS}ms`
          : err instanceof Error
            ? err.message
            : String(err),
      });
    } finally {
      clearTimeout(timer);
    }
  };
}
