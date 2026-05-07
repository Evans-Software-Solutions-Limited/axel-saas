/**
 * Tests for the pure shape-translation layer between Axel's
 * gateway-contract and OpenClaw's `/v1/chat/completions`.
 *
 * No HTTP, no fetch, no SDK — just `(input) => output` invariants.
 * If anything in this file ever requires a mock, the production
 * boundary has leaked and the transform module needs to be split.
 */
import { describe, expect, it } from "vitest";
import {
  buildBridgeChatResponse,
  buildChatCompletionsRequest,
  parseBridgeChatRequest,
  type OpenAIChatCompletionsResponse,
} from "../transforms/chatShape";

describe("parseBridgeChatRequest", () => {
  it("accepts a minimal valid body", () => {
    const result = parseBridgeChatRequest({
      message: "hi",
      userId: "user-1",
    });
    expect(result).toEqual({
      ok: true,
      value: { message: "hi", userId: "user-1" },
    });
  });

  it("forwards an explicit sessionId when present", () => {
    const result = parseBridgeChatRequest({
      message: "hi",
      userId: "user-1",
      sessionId: "sess-9",
    });
    expect(result).toEqual({
      ok: true,
      value: { message: "hi", userId: "user-1", sessionId: "sess-9" },
    });
  });

  it("rejects non-object bodies", () => {
    expect(parseBridgeChatRequest(null)).toEqual({
      ok: false,
      error: "body must be a JSON object",
    });
    expect(parseBridgeChatRequest("hello")).toEqual({
      ok: false,
      error: "body must be a JSON object",
    });
    expect(parseBridgeChatRequest(42)).toEqual({
      ok: false,
      error: "body must be a JSON object",
    });
  });

  it("rejects empty or non-string message", () => {
    expect(parseBridgeChatRequest({ message: "", userId: "u" })).toMatchObject({
      ok: false,
      error: "message must be a non-empty string",
    });
    expect(parseBridgeChatRequest({ message: 1, userId: "u" })).toMatchObject({
      ok: false,
      error: "message must be a non-empty string",
    });
    expect(parseBridgeChatRequest({ userId: "u" })).toMatchObject({
      ok: false,
      error: "message must be a non-empty string",
    });
  });

  it("rejects empty or non-string userId", () => {
    expect(parseBridgeChatRequest({ message: "hi", userId: "" })).toMatchObject(
      {
        ok: false,
        error: "userId must be a non-empty string",
      },
    );
    expect(
      parseBridgeChatRequest({ message: "hi", userId: null }),
    ).toMatchObject({
      ok: false,
      error: "userId must be a non-empty string",
    });
  });

  it("rejects an empty or wrong-typed sessionId when present", () => {
    expect(
      parseBridgeChatRequest({
        message: "hi",
        userId: "u",
        sessionId: "",
      }),
    ).toMatchObject({
      ok: false,
      error: "sessionId, when present, must be a non-empty string",
    });
    expect(
      parseBridgeChatRequest({
        message: "hi",
        userId: "u",
        sessionId: 42,
      }),
    ).toMatchObject({
      ok: false,
      error: "sessionId, when present, must be a non-empty string",
    });
  });

  it("rejects messages above 1 MB", () => {
    const oversized = "x".repeat(1_000_001);
    expect(
      parseBridgeChatRequest({ message: oversized, userId: "u" }),
    ).toMatchObject({
      ok: false,
      error: expect.stringMatching(/exceeds max size/),
    });
  });

  it("ignores extra top-level keys (forward-compatible)", () => {
    const result = parseBridgeChatRequest({
      message: "hi",
      userId: "u",
      futureKey: "ignored",
    });
    expect(result).toMatchObject({
      ok: true,
      value: { message: "hi", userId: "u" },
    });
  });
});

describe("buildChatCompletionsRequest", () => {
  it("maps a basic bridge request to OpenAI shape", () => {
    const out = buildChatCompletionsRequest(
      { message: "hello", userId: "user-1" },
      "anthropic/sonnet",
    );
    expect(out).toEqual({
      model: "anthropic/sonnet",
      messages: [{ role: "user", content: "hello" }],
      user: "user-1",
    });
  });

  it("uses the supplied default model verbatim", () => {
    const out = buildChatCompletionsRequest(
      { message: "x", userId: "u" },
      "openai/gpt-4o",
    );
    expect(out.model).toBe("openai/gpt-4o");
  });

  it("forwards the userId as the OpenAI `user` attribution field", () => {
    const out = buildChatCompletionsRequest(
      { message: "x", userId: "abuse-attribution-target" },
      "anthropic/haiku",
    );
    expect(out.user).toBe("abuse-attribution-target");
  });
});

describe("buildBridgeChatResponse", () => {
  const fixedId = () => "fixed-test-id";

  it("extracts the assistant content from the first choice", () => {
    const upstream: OpenAIChatCompletionsResponse = {
      id: "msg_abc",
      model: "anthropic/haiku",
      choices: [{ message: { role: "assistant", content: "Hello!" } }],
      usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
    };
    const result = buildBridgeChatResponse(upstream, {
      fallbackModel: "anthropic/haiku",
      sessionId: "sess-1",
      idGenerator: fixedId,
    });
    expect(result).toEqual({
      response: "Hello!",
      messageId: "msg_abc",
      sessionId: "sess-1",
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        model: "anthropic/haiku",
        cacheReadTokens: 0,
      },
    });
  });

  it("falls back to idGenerator when upstream has no id", () => {
    const result = buildBridgeChatResponse(
      { choices: [{ message: { content: "hi" } }] },
      {
        fallbackModel: "anthropic/haiku",
        sessionId: "sess-1",
        idGenerator: () => "generated-id",
      },
    );
    expect(result.messageId).toBe("generated-id");
  });

  it("returns empty response text when there are no choices", () => {
    const result = buildBridgeChatResponse(
      { id: "x", model: "m", usage: {} },
      {
        fallbackModel: "anthropic/haiku",
        sessionId: "sess-1",
        idGenerator: fixedId,
      },
    );
    expect(result.response).toBe("");
    expect(result.messageId).toBe("x");
  });

  it("falls back to fallbackModel when upstream omits model", () => {
    const result = buildBridgeChatResponse(
      { choices: [{ message: { content: "x" } }] },
      {
        fallbackModel: "fallback/model-id",
        sessionId: "sess-1",
        idGenerator: fixedId,
      },
    );
    expect(result.usage.model).toBe("fallback/model-id");
  });

  it("zero-fills usage counters when upstream omits the usage block", () => {
    const result = buildBridgeChatResponse(
      { choices: [{ message: { content: "x" } }] },
      {
        fallbackModel: "anthropic/haiku",
        sessionId: "sess-1",
        idGenerator: fixedId,
      },
    );
    expect(result.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      model: "anthropic/haiku",
      cacheReadTokens: 0,
    });
  });

  it("surfaces cache-read tokens from prompt_tokens_details", () => {
    const result = buildBridgeChatResponse(
      {
        choices: [{ message: { content: "x" } }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          prompt_tokens_details: { cached_tokens: 75 },
        },
      },
      {
        fallbackModel: "anthropic/haiku",
        sessionId: "sess-1",
        idGenerator: fixedId,
      },
    );
    expect(result.usage.cacheReadTokens).toBe(75);
  });
});
