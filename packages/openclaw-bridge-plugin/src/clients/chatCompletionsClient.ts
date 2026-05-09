/**
 * Internal HTTP client for OpenClaw's first-party
 * `POST /v1/chat/completions` endpoint.
 *
 * The bridge plugin itself runs *inside* the OpenClaw gateway process,
 * so the chat-completions endpoint is reachable on the loopback
 * interface (default `http://127.0.0.1:18789`). This client wraps
 * that single call with:
 *   - typed request/response shapes (see `../transforms/chatShape.ts`)
 *   - per-call AbortController timeout so a stuck model warmup can't
 *     hold the inbound `/api/chat` HTTP socket open indefinitely
 *   - structured error variants (no thrown exceptions) so the route
 *     handler can map to 5xx without try/catch noise
 *
 * `fetcher` is injectable for tests — production passes globalThis.fetch.
 */
import type {
  OpenAIChatCompletionsRequest,
  OpenAIChatCompletionsResponse,
} from "../transforms/chatShape";

export type ChatCompletionsResult =
  | { kind: "ok"; body: OpenAIChatCompletionsResponse }
  | { kind: "upstream_error"; status: number; bodyText: string }
  | { kind: "timeout" }
  | { kind: "network_error"; message: string }
  | { kind: "invalid_response"; message: string };

export interface ChatCompletionsClientInput {
  baseUrl: string;
  authorizationHeader: string | null;
  body: OpenAIChatCompletionsRequest;
  timeoutMs: number;
  fetcher?: typeof fetch;
  /**
   * Optional X-Request-Id forwarded from the inbound `/api/chat` call.
   * Lets traces in OpenClaw's gateway logs line up 1:1 with the
   * Axel-side traces from PR #98's gateway client.
   */
  requestId?: string;
}

export async function callChatCompletions(
  input: ChatCompletionsClientInput,
): Promise<ChatCompletionsResult> {
  const fetcher = input.fetcher ?? globalThis.fetch;
  const url = joinUrl(input.baseUrl, "/v1/chat/completions");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };
    if (input.authorizationHeader) {
      headers.authorization = input.authorizationHeader;
    }
    if (input.requestId) {
      headers["x-request-id"] = input.requestId;
    }

    let response: Response;
    try {
      response = await fetcher(url, {
        method: "POST",
        headers,
        body: JSON.stringify(input.body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return { kind: "timeout" };
      }
      return {
        kind: "network_error",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    if (!response.ok) {
      const bodyText = await safeReadText(response);
      return { kind: "upstream_error", status: response.status, bodyText };
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (err: unknown) {
      return {
        kind: "invalid_response",
        message: err instanceof Error ? err.message : String(err),
      };
    }

    // We trust OpenClaw to return the shape it documents — we don't
    // re-validate field-by-field here. The shape transform layer
    // (`buildBridgeChatResponse`) tolerates missing fields gracefully.
    return { kind: "ok", body: parsed as OpenAIChatCompletionsResponse };
  } finally {
    clearTimeout(timer);
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Path join that doesn't choke on a base URL with or without a
 * trailing slash. Avoids pulling in a URL polyfill or rewriting
 * `new URL(...)` semantics.
 */
function joinUrl(base: string, path: string): string {
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  return path.startsWith("/") ? `${trimmed}${path}` : `${trimmed}/${path}`;
}
