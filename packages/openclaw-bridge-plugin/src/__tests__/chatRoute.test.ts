/**
 * Tests for `POST /api/chat`. The handler is wired through the
 * factory so the chat-completions client and id generator are
 * deterministic. We assert: status, headers, response body shape,
 * and how each upstream error variant maps to an HTTP status.
 */
import { describe, expect, it, vi } from "vitest";
import { makeChatRouteHandler } from "../handlers/chatRoute";
import {
  makeFakeRequest,
  makeFakeResponse,
  readJsonResponse,
} from "./testHelpers";

const baseConfig = {
  chatCompletionsBaseUrl: "http://127.0.0.1:18789",
  defaultModel: "anthropic/haiku",
};

const validBody = JSON.stringify({ message: "hi", userId: "u-1" });

describe("makeChatRouteHandler", () => {
  it("returns 200 with the gateway-contract shape on a successful upstream call", async () => {
    const callChatCompletions = vi.fn().mockResolvedValue({
      kind: "ok",
      body: {
        id: "msg_xyz",
        model: "anthropic/haiku",
        choices: [{ message: { content: "hello there" } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 4,
          prompt_tokens_details: { cached_tokens: 3 },
        },
      },
    });

    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions,
      idGenerator: () => "fixed-id",
    });

    const req = makeFakeRequest({
      method: "POST",
      headers: {
        authorization: "Bearer t",
        "x-request-id": "req-1",
      },
      body: validBody,
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);

    const snap = snapshot();
    expect(snap.statusCode).toBe(200);
    expect(readJsonResponse(snap)).toEqual({
      response: "hello there",
      messageId: "msg_xyz",
      sessionId: "fixed-id",
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        model: "anthropic/haiku",
        cacheReadTokens: 3,
      },
    });
  });

  it("preserves an explicit sessionId from the request", async () => {
    const callChatCompletions = vi.fn().mockResolvedValue({
      kind: "ok",
      body: { choices: [{ message: { content: "x" } }] },
    });
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions,
      idGenerator: () => "should-not-be-used",
    });
    const req = makeFakeRequest({
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: "hi",
        userId: "u",
        sessionId: "stable-sess",
      }),
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const body = readJsonResponse(snapshot()) as { sessionId: string };
    expect(body.sessionId).toBe("stable-sess");
  });

  it("forwards Authorization and X-Request-Id to the upstream call", async () => {
    const callChatCompletions = vi.fn().mockResolvedValue({
      kind: "ok",
      body: { choices: [{ message: { content: "x" } }] },
    });
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions,
    });
    const req = makeFakeRequest({
      method: "POST",
      headers: { authorization: "Bearer abc", "x-request-id": "trace-9" },
      body: validBody,
    });
    const { res } = makeFakeResponse();
    await handler(req, res);
    expect(callChatCompletions).toHaveBeenCalledOnce();
    const call = callChatCompletions.mock.calls[0]![0];
    expect(call.authorizationHeader).toBe("Bearer abc");
    expect(call.requestId).toBe("trace-9");
    expect(call.body).toEqual({
      model: "anthropic/haiku",
      messages: [{ role: "user", content: "hi" }],
      user: "u-1",
    });
  });

  it("rejects non-POST requests with 405", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn(),
    });
    const req = makeFakeRequest({ method: "GET" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(405);
  });

  it("returns 400 on invalid JSON", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn(),
    });
    const req = makeFakeRequest({ method: "POST", body: "{not json" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(400);
    expect((readJsonResponse(snap) as { error: string }).error).toBe(
      "invalid_json",
    );
  });

  it("returns 400 on shape-violating bodies", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn(),
    });
    const req = makeFakeRequest({
      method: "POST",
      body: JSON.stringify({ message: "" }),
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(400);
    expect((readJsonResponse(snap) as { error: string }).error).toBe(
      "invalid_request",
    );
  });

  it("returns 413 when the body exceeds the size cap", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn(),
    });
    // readJsonBody default cap is 1 MB; build something just over.
    const oversized = JSON.stringify({
      message: "x".repeat(1_100_000),
      userId: "u",
    });
    const req = makeFakeRequest({
      method: "POST",
      body: oversized,
      chunkSize: 100_000,
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(413);
  });

  it("returns 504 on upstream timeout", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn().mockResolvedValue({ kind: "timeout" }),
    });
    const req = makeFakeRequest({ method: "POST", body: validBody });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(504);
    expect((readJsonResponse(snap) as { error: string }).error).toBe(
      "upstream_timeout",
    );
  });

  it("returns 502 on network errors", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn().mockResolvedValue({
        kind: "network_error",
        message: "ECONNREFUSED",
      }),
    });
    const req = makeFakeRequest({ method: "POST", body: validBody });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(502);
  });

  it("returns 502 when the upstream body fails to parse", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn().mockResolvedValue({
        kind: "invalid_response",
        message: "garbage",
      }),
    });
    const req = makeFakeRequest({ method: "POST", body: validBody });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(502);
  });

  it("propagates upstream HTTP status (so 429 stays 429)", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn().mockResolvedValue({
        kind: "upstream_error",
        status: 429,
        bodyText: "rate limited",
      }),
    });
    const req = makeFakeRequest({ method: "POST", body: validBody });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(429);
  });

  it("falls back to a generated UUID when no idGenerator is supplied", async () => {
    const handler = makeChatRouteHandler(baseConfig, {
      callChatCompletions: vi.fn().mockResolvedValue({
        kind: "ok",
        body: { choices: [{ message: { content: "x" } }] },
      }),
    });
    const req = makeFakeRequest({ method: "POST", body: validBody });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const body = readJsonResponse(snapshot()) as { sessionId: string };
    // crypto.randomUUID gives the canonical 36-char form
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});
