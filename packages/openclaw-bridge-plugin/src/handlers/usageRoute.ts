/**
 * `GET /api/usage` — query current token usage from inside the
 * container.
 *
 * **MVP scope (this PR):** return zero-baseline counters with an
 * explicit `source: "bridge_zero_baseline"` discriminator. Per the
 * gateway-contract spec (`specs/gateway-contract/design.md` §3 →
 * "Used for syncing usage data if the backend's own tracking
 * diverges. Secondary source — primary tracking is in our
 * `token_usage` table from per-message `usage` blocks") this is the
 * sanctioned MVP behaviour: PR #96 already lives the canonical token
 * usage in the `token_usage` table on every `/api/chat` reply, so
 * this endpoint exists as a reconciliation fallback that doesn't
 * have to be exact.
 *
 * Wiring real numbers in here means hooking into OpenClaw's gateway
 * usage telemetry — that is a follow-up once we know whether we'll
 * even need a divergence reconciler in production. Keeping the
 * endpoint live (rather than 404'd) means the backend gets a
 * stable contract surface to call against and can decide policy
 * (compare with `token_usage` totals, alert if drift > N%) without
 * waiting on us.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { writeJson } from "./httpHelpers";

export interface UsageRouteConfig {
  defaultModel: string;
}

export function makeUsageRouteHandler(config: UsageRouteConfig) {
  return function usageRouteHandler(
    req: IncomingMessage,
    res: ServerResponse,
  ): void {
    if (req.method !== "GET") {
      writeJson(res, 405, {
        error: "method_not_allowed",
        message: "GET required",
      });
      return;
    }

    writeJson(res, 200, {
      today: {
        inputTokens: 0,
        outputTokens: 0,
        model: config.defaultModel,
        requestCount: 0,
      },
      session: {
        inputTokens: 0,
        outputTokens: 0,
      },
      source: "bridge_zero_baseline",
      message:
        "Bridge-side counters are zero by design. The canonical source is the backend `token_usage` table populated from per-message /api/chat usage blocks (PR #96). Real container-side telemetry hooks land with workspace-config-sync.",
    });
  };
}
