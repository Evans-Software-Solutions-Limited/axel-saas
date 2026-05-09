/**
 * Tests for the internal chat-completions HTTP client.
 *
 * Mocks the `fetcher` argument so no real network IO happens. Asserts
 * the result-type discrimination for every error mode the production
 * route handler branches on (timeout, network, upstream, invalid).
 */
import { describe, expect, it, vi } from "vitest";
import { callChatCompletions } from "../clients/chatCompletionsClient";
import type { OpenAIChatCompletionsRequest } from "../transforms/chatShape";

const validBody: OpenAIChatCompletionsRequest = {
  model: "anthropic/haiku",
  messages: [{ role: "user", content: "hi" }],
};

describe("callChatCompletions", () => {
  it("returns ok with the parsed body on a 2xx", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "msg_1",
          model: "anthropic/haiku",
          choices: [{ message: { content: "hi back" } }],
          usage: { prompt_tokens: 5, completion_tokens: 2 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: "Bearer t",
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.body.choices?.[0]?.message?.content).toBe("hi back");
    }
  });

  it("forwards Authorization, content-type, and X-Request-Id headers", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: "Bearer fwdtoken",
      body: validBody,
      timeoutMs: 1000,
      fetcher,
      requestId: "trace-99",
    });
    const call = fetcher.mock.calls[0]!;
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["authorization"]).toBe("Bearer fwdtoken");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-request-id"]).toBe("trace-99");
  });

  it("omits Authorization when null", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    const headers = (fetcher.mock.calls[0]![1] as RequestInit)
      .headers as Record<string, string>;
    expect(headers["authorization"]).toBeUndefined();
  });

  it("returns upstream_error on a non-2xx response", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("rate limited mate", { status: 429 }));
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(result).toEqual({
      kind: "upstream_error",
      status: 429,
      bodyText: "rate limited mate",
    });
  });

  it("returns timeout when fetcher signals AbortError", async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1,
      fetcher,
    });
    expect(result).toEqual({ kind: "timeout" });
  });

  it("returns network_error on generic fetch failures", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(result.kind).toBe("network_error");
    if (result.kind === "network_error") {
      expect(result.message).toBe("ECONNREFUSED");
    }
  });

  it("returns network_error on non-Error rejections", async () => {
    const fetcher = vi.fn().mockRejectedValue("string-rejection");
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(result.kind).toBe("network_error");
    if (result.kind === "network_error") {
      expect(result.message).toBe("string-rejection");
    }
  });

  it("returns invalid_response when the body is not JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response("not json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(result.kind).toBe("invalid_response");
  });

  it("survives an upstream body that fails text() during error read", async () => {
    const broken = {
      ok: false,
      status: 502,
      text: () => Promise.reject(new Error("body stream broken")),
    };
    const fetcher = vi.fn().mockResolvedValue(broken as unknown as Response);
    const result = await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(result).toEqual({
      kind: "upstream_error",
      status: 502,
      bodyText: "",
    });
  });

  it("joins URLs with or without a trailing slash on the base", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789/",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(fetcher.mock.calls[0]![0]).toBe(
      "http://127.0.0.1:18789/v1/chat/completions",
    );

    fetcher.mockClear();
    await callChatCompletions({
      baseUrl: "http://127.0.0.1:18789",
      authorizationHeader: null,
      body: validBody,
      timeoutMs: 1000,
      fetcher,
    });
    expect(fetcher.mock.calls[0]![0]).toBe(
      "http://127.0.0.1:18789/v1/chat/completions",
    );
  });

  it("falls back to globalThis.fetch when no fetcher is supplied", async () => {
    // Stash the real fetch and replace with a spy for this test only.
    const originalFetch = globalThis.fetch;
    const spy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    try {
      const result = await callChatCompletions({
        baseUrl: "http://127.0.0.1:18789",
        authorizationHeader: null,
        body: validBody,
        timeoutMs: 1000,
      });
      expect(result.kind).toBe("ok");
      expect(spy).toHaveBeenCalledOnce();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
