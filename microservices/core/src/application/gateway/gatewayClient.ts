/**
 * Typed client for the OpenClaw container gateway.
 *
 * Pulls the inline `fetch(...)` calls out of route handlers so every
 * caller (chat, future health/reload utilities) gets:
 *   - validated gateway URLs (HTTPS in prod, no loopback/private IPs)
 *   - per-endpoint timeouts via AbortController (60s chat, 5s health,
 *     10s reload — all per `specs/gateway-contract/design.md` §10)
 *   - `X-Request-Id` injected for distributed tracing across the
 *     backend → container boundary
 *   - structured Result variants instead of throwing — handlers can
 *     pattern-match on `{kind: "ok" | "rate_limited" | "error" |
 *     "timeout" | "network_error"}` and pick a fail-open vs
 *     fail-closed policy without re-deriving the categories from raw
 *     fetch errors
 *
 * Contract reference: `specs/gateway-contract/design.md`. Container
 * side is Ferenc's work; until it lands the `triggerReload` and
 * `checkHealth` calls return `{kind: "error", status: 404}` cleanly
 * and callers fall back to the existing behaviour (heartbeat-driven
 * reload, DB-state-only agent status).
 */

import { validateGatewayUrl } from "./gatewayUrl";

// ─── Timeouts (spec §10) ───────────────────────────────────────────

export const TIMEOUT_CHAT_MS = 60_000;
export const TIMEOUT_HEALTH_MS = 5_000;
export const TIMEOUT_RELOAD_MS = 10_000;

// ─── Result types ───────────────────────────────────────────────────

export interface ChatUsage {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export interface ChatResponseBody {
  response?: string;
  message?: string;
  messageId?: string;
  sessionId?: string;
  usage?: ChatUsage;
}

export interface HealthResponseBody {
  status?: "healthy" | "unhealthy";
  agentReady?: boolean;
  uptime?: number;
  reason?: string;
}

export interface ReloadResponseBody {
  status?: "reloaded" | "deferred";
  filesReloaded?: string[];
  message?: string;
}

/**
 * Discriminated union for every gateway call. Callers branch on
 * `kind`. `error` carries the upstream HTTP status (so e.g. 404 from
 * a not-yet-implemented endpoint is distinguishable from a 5xx
 * actual failure).
 */
export type GatewayResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "rate_limited"; retryAfter: number; message?: string }
  | { kind: "error"; status: number; message?: string }
  | { kind: "timeout" }
  | { kind: "network_error"; message: string }
  | { kind: "invalid_url" };

// ─── Internals ──────────────────────────────────────────────────────

export interface GatewayFetcher {
  fetch: typeof fetch;
}

const defaultFetcher: GatewayFetcher = { fetch };

interface GatewayCallOptions {
  rawGatewayUrl: string;
  path: string;
  method: "GET" | "POST";
  timeoutMs: number;
  body?: unknown;
  authorization?: string;
  /** Override the auto-generated request id (mostly for tests). */
  requestId?: string;
  /** Injectable for tests; defaults to global `fetch`. */
  fetcher?: GatewayFetcher;
}

async function performGatewayCall<T>(
  opts: GatewayCallOptions,
): Promise<GatewayResult<T>> {
  const validatedUrl = validateGatewayUrl(opts.rawGatewayUrl);
  if (!validatedUrl) {
    return { kind: "invalid_url" };
  }

  const url = `${validatedUrl.replace(/\/$/, "")}${opts.path}`;
  const requestId = opts.requestId ?? crypto.randomUUID();

  const controller = new AbortController();
  const timeoutTimer = setTimeout(() => controller.abort(), opts.timeoutMs);

  const headers: Record<string, string> = {
    "X-Request-Id": requestId,
  };
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.authorization) {
    headers["Authorization"] = opts.authorization;
  }

  const fetcher = opts.fetcher ?? defaultFetcher;

  let response: Response;
  try {
    response = await fetcher.fetch(url, {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutTimer);
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "timeout" };
    }
    return {
      kind: "network_error",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Body-read phase. The original timeout was only in scope until the
  // headers landed — a gateway that sent headers promptly but
  // drip-fed the body could still pin the Lambda indefinitely. Keep
  // the AbortSignal active across `response.json()` so the same
  // 60s/5s/10s budget covers the entire wall-clock cost of the call.
  // Distinguish three terminal states for the body phase:
  //   - AbortError: timeout fired mid-body; surface as kind: "timeout".
  //   - Other errors (malformed JSON, network reset mid-body): the
  //     headers/status are still valid, so fall through with body=null
  //     and let the status-based branches below decide. This preserves
  //     the existing behaviour where a 500 with no JSON body still
  //     returns kind: "error".
  let body: unknown = null;
  try {
    body = await response.json();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      clearTimeout(timeoutTimer);
      return { kind: "timeout" };
    }
    body = null;
  }
  clearTimeout(timeoutTimer);

  if (response.status === 429) {
    const ra = readRetryAfter(response, body);
    return {
      kind: "rate_limited",
      retryAfter: ra,
      message: readBodyMessage(body),
    };
  }

  if (!response.ok) {
    return {
      kind: "error",
      status: response.status,
      message: readBodyMessage(body),
    };
  }

  return { kind: "ok", body: (body ?? {}) as T };
}

function readRetryAfter(response: Response, body: unknown): number {
  // Prefer the body's `retryAfter` (spec §3 chat 429 shape); fall back
  // to the `Retry-After` header; default to 5s if neither is present.
  if (body && typeof body === "object" && "retryAfter" in body) {
    const value = (body as { retryAfter?: unknown }).retryAfter;
    if (typeof value === "number" && value > 0) return value;
  }
  const header = response.headers.get("Retry-After");
  if (header) {
    const parsed = Number(header);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 5;
}

function readBodyMessage(body: unknown): string | undefined {
  // Only read the `message` field — that's the human-readable
  // explanation per the gateway-contract spec (§3 chat 500 shape:
  // `{ error: "agent_error", message: "Failed to process message" }`).
  // The `error` field is a machine-readable code (`rate_limited`,
  // `agent_error`, `invalid_code`, ...) — surfacing it as a "message"
  // leaks raw codes through to the user. Callers that need the code
  // can read the body themselves; this helper is for the friendly
  // copy that ends up in 429/5xx responses.
  if (body && typeof body === "object") {
    const obj = body as { message?: unknown };
    if (typeof obj.message === "string" && obj.message.length > 0) {
      return obj.message;
    }
  }
  return undefined;
}

// ─── Public surface ─────────────────────────────────────────────────

export interface PostChatInput {
  rawGatewayUrl: string;
  message: string;
  userId: string;
  sessionId?: string;
  authorization?: string;
  requestId?: string;
  fetcher?: GatewayFetcher;
  timeoutMs?: number;
}

export async function postChat(
  input: PostChatInput,
): Promise<GatewayResult<ChatResponseBody>> {
  return performGatewayCall<ChatResponseBody>({
    rawGatewayUrl: input.rawGatewayUrl,
    path: "/api/chat",
    method: "POST",
    timeoutMs: input.timeoutMs ?? TIMEOUT_CHAT_MS,
    body: {
      message: input.message,
      userId: input.userId,
      ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    },
    authorization: input.authorization,
    requestId: input.requestId,
    fetcher: input.fetcher,
  });
}

export async function checkHealth(input: {
  rawGatewayUrl: string;
  /**
   * Bearer header (`"Bearer <token>"`) to send as Authorization. The
   * bridge plugin (PR #99) registers `/api/health` with `auth:
   * "gateway"`, so OpenClaw enforces the gateway token before the
   * route handler runs. If the backend has no token to send (e.g.
   * during local dev with `OPENCLAW_DEV_MODE=1`), pass `null` —
   * a 401 is then a normal fire-and-forget failure, not a crash.
   */
  authorization?: string | null;
  fetcher?: GatewayFetcher;
  timeoutMs?: number;
}): Promise<GatewayResult<HealthResponseBody>> {
  return performGatewayCall<HealthResponseBody>({
    rawGatewayUrl: input.rawGatewayUrl,
    path: "/api/health",
    method: "GET",
    timeoutMs: input.timeoutMs ?? TIMEOUT_HEALTH_MS,
    authorization: input.authorization ?? undefined,
    fetcher: input.fetcher,
  });
}

export async function triggerReload(input: {
  rawGatewayUrl: string;
  reason: string;
  files: string[];
  /**
   * Bearer header (`"Bearer <token>"`) for the gateway's auth check.
   * Same semantics as `checkHealth.authorization`. Reload calls are
   * fire-and-forget (the spec says missed reloads fall back to
   * heartbeat-driven re-reads), so a 401/auth failure is logged but
   * does not propagate.
   */
  authorization?: string | null;
  fetcher?: GatewayFetcher;
  timeoutMs?: number;
}): Promise<GatewayResult<ReloadResponseBody>> {
  return performGatewayCall<ReloadResponseBody>({
    rawGatewayUrl: input.rawGatewayUrl,
    path: "/api/reload",
    method: "POST",
    timeoutMs: input.timeoutMs ?? TIMEOUT_RELOAD_MS,
    body: { reason: input.reason, files: input.files },
    authorization: input.authorization ?? undefined,
    fetcher: input.fetcher,
  });
}
