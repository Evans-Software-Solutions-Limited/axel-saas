/**
 * Pure shape translation between Axel's gateway-contract spec and
 * OpenClaw's first-party `/v1/chat/completions` endpoint.
 *
 * - Inbound: gateway-contract `/api/chat` body
 *   `{message, userId, sessionId?}` → OpenAI Chat Completions request
 *   `{model, messages, user}`.
 * - Outbound: OpenAI Chat Completions response
 *   `{choices, usage, model}` → gateway-contract response
 *   `{response, messageId, sessionId, usage: {inputTokens, outputTokens, model, cacheReadTokens}}`.
 *
 * Decoupled from any HTTP transport so tests are pure-function fast and
 * the request/response logic stays unit-testable without mocking
 * `node:http` or fetch.
 *
 * Contract reference: `specs/gateway-contract/design.md` §3.
 */

export interface BridgeChatRequest {
  message: string;
  userId: string;
  sessionId?: string;
}

export interface BridgeChatResponse {
  response: string;
  messageId: string;
  sessionId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    model: string;
    cacheReadTokens: number;
  };
}

export interface OpenAIChatCompletionsRequest {
  model: string;
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  user?: string;
}

export interface OpenAIChatCompletionsResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /**
     * Anthropic-style cache hit count surfaced in the OpenAI-shaped
     * envelope by some providers.
     */
    prompt_tokens_details?: { cached_tokens?: number };
  };
}

/**
 * Validation errors are returned as a discriminated tag rather than
 * thrown so the handler can map them to a 400 with a structured body.
 */
export type BridgeChatRequestParseResult =
  | { ok: true; value: BridgeChatRequest }
  | { ok: false; error: string };

const MAX_MESSAGE_BYTES = 1_000_000; // 1 MB — generous; matches OpenClaw default for /v1/chat/completions but we're lenient up the stack so the gateway gets to be the canonical limit.

/**
 * Parse + validate the inbound `/api/chat` body.
 *
 * Strict: rejects anything that isn't `{message: string, userId: string,
 * sessionId?: string}` shaped. Permissive on extra keys at the top
 * level so additive backend changes don't break us.
 */
export function parseBridgeChatRequest(
  raw: unknown,
): BridgeChatRequestParseResult {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, error: "body must be a JSON object" };
  }
  const obj = raw as Record<string, unknown>;
  const message = obj.message;
  const userId = obj.userId;
  const sessionId = obj.sessionId;

  if (typeof message !== "string" || message.length === 0) {
    return { ok: false, error: "message must be a non-empty string" };
  }
  if (Buffer.byteLength(message, "utf8") > MAX_MESSAGE_BYTES) {
    return {
      ok: false,
      error: `message exceeds max size (${MAX_MESSAGE_BYTES} bytes)`,
    };
  }
  if (typeof userId !== "string" || userId.length === 0) {
    return { ok: false, error: "userId must be a non-empty string" };
  }
  if (
    sessionId !== undefined &&
    (typeof sessionId !== "string" || sessionId.length === 0)
  ) {
    return {
      ok: false,
      error: "sessionId, when present, must be a non-empty string",
    };
  }

  return {
    ok: true,
    value: {
      message,
      userId,
      ...(typeof sessionId === "string" ? { sessionId } : {}),
    },
  };
}

/**
 * Translate gateway-contract `/api/chat` → OpenAI Chat Completions
 * request. `defaultModel` is supplied by the plugin config; OpenClaw's
 * gateway resolves the model further (alias resolution, provider
 * routing) — we just have to send something reasonable.
 */
export function buildChatCompletionsRequest(
  bridgeRequest: BridgeChatRequest,
  defaultModel: string,
): OpenAIChatCompletionsRequest {
  return {
    model: defaultModel,
    messages: [{ role: "user", content: bridgeRequest.message }],
    // OpenAI-style `user` field is conventionally an opaque per-user
    // identifier; we forward Axel's userId so abuse/usage attribution
    // stays consistent across our and OpenClaw's logs.
    user: bridgeRequest.userId,
  };
}

/**
 * Translate OpenAI Chat Completions response → gateway-contract
 * `/api/chat` response. Unknown / missing fields fall back to safe
 * defaults rather than throwing — the contract guarantees a shape, and
 * a partial response from OpenClaw is still better than a 500.
 *
 * `idGenerator` is injected so tests can pin the messageId; the
 * production caller passes `crypto.randomUUID`.
 */
export function buildBridgeChatResponse(
  openaiResponse: OpenAIChatCompletionsResponse,
  ctx: {
    fallbackModel: string;
    sessionId: string;
    idGenerator: () => string;
  },
): BridgeChatResponse {
  const firstChoice = openaiResponse.choices?.[0];
  const responseText = firstChoice?.message?.content ?? "";
  const messageId = openaiResponse.id ?? ctx.idGenerator();
  const usage = openaiResponse.usage ?? {};
  return {
    response: responseText,
    messageId,
    sessionId: ctx.sessionId,
    usage: {
      inputTokens: usage.prompt_tokens ?? 0,
      outputTokens: usage.completion_tokens ?? 0,
      model: openaiResponse.model ?? ctx.fallbackModel,
      cacheReadTokens: usage.prompt_tokens_details?.cached_tokens ?? 0,
    },
  };
}
