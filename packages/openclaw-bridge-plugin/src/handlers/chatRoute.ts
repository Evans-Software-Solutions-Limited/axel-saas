/**
 * `POST /api/chat` — bridge the gateway-contract shape to OpenClaw's
 * `/v1/chat/completions`.
 *
 * Steps:
 *   1. Read + parse JSON body, enforce shape (`{message, userId,
 *      sessionId?}`).
 *   2. Build the OpenAI-shaped chat-completions request.
 *   3. Call OpenClaw's first-party `/v1/chat/completions` over loopback.
 *   4. Reshape the response into gateway-contract `{response,
 *      messageId, sessionId, usage}` per `specs/gateway-contract/
 *      design.md` §3.
 *
 * Error mapping:
 *   - body parse / validation → 400 with `{error, message}`
 *   - upstream timeout → 504
 *   - upstream non-2xx → propagate the upstream status (so 429s flow
 *     through unchanged for backend rate-limit handling)
 *   - upstream network/parse error → 502
 *
 * Decoupled from `node:http` for testability — the handler factory
 * takes an injectable `callChatCompletions` and `idGenerator`.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  callChatCompletions,
  type ChatCompletionsResult,
} from "../clients/chatCompletionsClient";
import {
  buildBridgeChatResponse,
  buildChatCompletionsRequest,
  parseBridgeChatRequest,
} from "../transforms/chatShape";
import {
  readAuthorization,
  readJsonBody,
  readRequestId,
  writeJson,
} from "./httpHelpers";

export const TIMEOUT_CHAT_MS = 60_000;

export interface ChatRouteConfig {
  chatCompletionsBaseUrl: string;
  defaultModel: string;
}

export interface ChatRouteDeps {
  callChatCompletions?: typeof callChatCompletions;
  idGenerator?: () => string;
  fetcher?: typeof fetch;
}

/**
 * Build the route handler. Production wiring is in `index.ts`;
 * tests inject mocks via `deps`.
 */
export function makeChatRouteHandler(
  config: ChatRouteConfig,
  deps: ChatRouteDeps = {},
) {
  const callImpl = deps.callChatCompletions ?? callChatCompletions;
  const idGen = deps.idGenerator ?? (() => globalThis.crypto.randomUUID());
  const fetcher = deps.fetcher;

  return async function chatRouteHandler(
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
    switch (bodyResult.kind) {
      case "invalid_json":
        writeJson(res, 400, {
          error: "invalid_json",
          message: bodyResult.message,
        });
        return;
      case "too_large":
        writeJson(res, 413, {
          error: "payload_too_large",
          message: `body exceeds ${bodyResult.limit} bytes`,
        });
        return;
      case "stream_error":
        writeJson(res, 400, {
          error: "stream_error",
          message: bodyResult.message,
        });
        return;
      case "ok":
        break;
    }

    const parsed = parseBridgeChatRequest(bodyResult.body);
    if (!parsed.ok) {
      writeJson(res, 400, {
        error: "invalid_request",
        message: parsed.error,
      });
      return;
    }
    const bridgeRequest = parsed.value;

    const upstream: ChatCompletionsResult = await callImpl({
      baseUrl: config.chatCompletionsBaseUrl,
      authorizationHeader: readAuthorization(req),
      body: buildChatCompletionsRequest(bridgeRequest, config.defaultModel),
      timeoutMs: TIMEOUT_CHAT_MS,
      requestId: readRequestId(req),
      fetcher,
    });

    switch (upstream.kind) {
      case "timeout":
        writeJson(res, 504, {
          error: "upstream_timeout",
          message: `chat-completions exceeded ${TIMEOUT_CHAT_MS}ms`,
        });
        return;
      case "network_error":
        writeJson(res, 502, {
          error: "upstream_network_error",
          message: upstream.message,
        });
        return;
      case "invalid_response":
        writeJson(res, 502, {
          error: "upstream_invalid_response",
          message: upstream.message,
        });
        return;
      case "upstream_error":
        // Propagate the upstream status so e.g. a 429 from the model
        // provider surfaces as a 429 to the backend's chat handler
        // and PR #97's rate-limiter doesn't mistake it for a 500.
        writeJson(res, upstream.status, {
          error: "upstream_error",
          status: upstream.status,
          message: upstream.bodyText.slice(0, 500),
        });
        return;
      case "ok": {
        const sessionId = bridgeRequest.sessionId ?? idGen();
        const body = buildBridgeChatResponse(upstream.body, {
          fallbackModel: config.defaultModel,
          sessionId,
          idGenerator: idGen,
        });
        writeJson(res, 200, body);
        return;
      }
    }
  };
}
