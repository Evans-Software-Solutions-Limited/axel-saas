import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TIMEOUT_CHAT_MS,
  TIMEOUT_HEALTH_MS,
  TIMEOUT_RELOAD_MS,
  checkHealth,
  postChat,
  triggerReload,
  type GatewayFetcher,
} from "../gatewayClient";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
beforeEach(() => {
  // Default to dev so the URL validator accepts http://localhost:18789.
  process.env.NODE_ENV = "development";
  // Lock the request id for deterministic header assertions.
  vi.spyOn(crypto, "randomUUID").mockReturnValue(
    "00000000-0000-0000-0000-000000000001",
  );
});

// Restore NODE_ENV after every test so a test that sets it to
// "production" doesn't leak the value into the next test (or worse,
// into a sibling test file run in the same vitest worker).
afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

function makeFetcher(
  impl: (url: string, init: RequestInit) => Response | Promise<Response>,
): GatewayFetcher {
  return {
    fetch: vi.fn(impl) as unknown as typeof fetch,
  };
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("postChat", () => {
  it("calls /api/chat with the right body, headers, and request id", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse({
        response: "hi",
        usage: { inputTokens: 10, outputTokens: 20, model: "anthropic/haiku" },
      }),
    );

    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hello",
      userId: "user-1",
      authorization: "Bearer abc",
      requestId: "req-test-1",
      fetcher,
    });

    expect(result).toEqual({
      kind: "ok",
      body: {
        response: "hi",
        usage: {
          inputTokens: 10,
          outputTokens: 20,
          model: "anthropic/haiku",
        },
      },
    });
    const fetchMock = fetcher.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:18789/api/chat");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Request-Id"]).toBe("req-test-1");
    expect(headers["Authorization"]).toBe("Bearer abc");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ message: "hello", userId: "user-1" });
  });

  it("includes sessionId when provided", async () => {
    const fetcher = makeFetcher(() => jsonResponse({ response: "ok" }));
    await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      sessionId: "sess-42",
      fetcher,
    });
    const fetchMock = fetcher.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.sessionId).toBe("sess-42");
  });

  it("auto-generates a request id when one isn't provided", async () => {
    const fetcher = makeFetcher(() => jsonResponse({ response: "ok" }));
    await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    const fetchMock = fetcher.fetch as unknown as ReturnType<typeof vi.fn>;
    const headers = fetchMock.mock.calls[0]![1].headers as Record<
      string,
      string
    >;
    expect(headers["X-Request-Id"]).toBe(
      "00000000-0000-0000-0000-000000000001",
    );
  });

  it("returns invalid_url when the gateway URL fails validation", async () => {
    const fetcher = makeFetcher(() => jsonResponse({}));
    const result = await postChat({
      rawGatewayUrl: "not a url",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result).toEqual({ kind: "invalid_url" });
    expect(
      (fetcher.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(0);
  });

  it("maps a 429 response to {kind: 'rate_limited', retryAfter}", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse(
        {
          error: "rate_limited",
          message: "Agent is processing another request.",
          retryAfter: 7,
        },
        { status: 429 },
      ),
    );
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result).toEqual({
      kind: "rate_limited",
      retryAfter: 7,
      message: "Agent is processing another request.",
    });
  });

  it("falls back to the Retry-After header when the body lacks retryAfter", async () => {
    const fetcher = makeFetcher(
      () =>
        new Response(JSON.stringify({ error: "rate_limited" }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "12" },
        }),
    );
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result.kind).toBe("rate_limited");
    if (result.kind === "rate_limited") {
      expect(result.retryAfter).toBe(12);
    }
  });

  it("defaults retryAfter to 5s when neither body nor header carry one", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse({ error: "rate_limited" }, { status: 429 }),
    );
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result.kind).toBe("rate_limited");
    if (result.kind === "rate_limited") {
      expect(result.retryAfter).toBe(5);
    }
  });

  it("maps a 500 to {kind: 'error', status: 500} with the body message", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse({ error: "agent_error", message: "boom" }, { status: 500 }),
    );
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result).toEqual({ kind: "error", status: 500, message: "boom" });
  });

  it("maps a network error to {kind: 'network_error'}", async () => {
    const fetcher = makeFetcher(() => {
      throw new Error("connection refused");
    });
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result).toEqual({
      kind: "network_error",
      message: "connection refused",
    });
  });

  it("maps an aborted request to {kind: 'timeout'}", async () => {
    // Simulate AbortError without actually waiting 60s — invoke the
    // fetch with a 1ms timeout and a fetcher that respects the signal.
    const fetcher: GatewayFetcher = {
      fetch: ((_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        })) as unknown as typeof fetch,
    };
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
      timeoutMs: 1,
    });
    expect(result).toEqual({ kind: "timeout" });
  });

  it("maps an abort during body-read to {kind: 'timeout'} (drip-fed body protection)", async () => {
    // Regression for the bug where the timeout cleared as soon as
    // headers landed: a gateway that sent `200 OK` immediately but
    // then drip-fed the body could pin the Lambda indefinitely. The
    // signal must remain active through `response.json()`.
    const stallingResponse: Response = {
      status: 200,
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () =>
        new Promise<unknown>((_resolve, reject) => {
          // Simulate fetch's body reader: rejects with AbortError when
          // the request signal aborts mid-read. Modern fetch does this
          // natively; here we wire it explicitly.
          setTimeout(() => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          }, 5);
        }),
    } as unknown as Response;

    const fetcher: GatewayFetcher = {
      fetch: (() =>
        Promise.resolve(stallingResponse)) as unknown as typeof fetch,
    };
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
      timeoutMs: 1,
    });
    expect(result).toEqual({ kind: "timeout" });
  });

  it("treats malformed JSON (non-abort body error) as ok with empty body", async () => {
    // The body-read phase distinguishes AbortError (timeout) from
    // other failures (malformed JSON, network reset). A 200 with junk
    // body should still fall through to the status-based success
    // branch with body={}, not surface as a timeout.
    const malformedResponse: Response = {
      status: 200,
      ok: true,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as unknown as Response;

    const fetcher: GatewayFetcher = {
      fetch: (() =>
        Promise.resolve(malformedResponse)) as unknown as typeof fetch,
    };
    const result = await postChat({
      rawGatewayUrl: "http://localhost:18789",
      message: "hi",
      userId: "u",
      fetcher,
    });
    expect(result).toEqual({ kind: "ok", body: {} });
  });

  it("uses the chat-spec 60s default timeout when none is passed", () => {
    expect(TIMEOUT_CHAT_MS).toBe(60_000);
  });
});

describe("checkHealth", () => {
  it("calls GET /api/health and returns the body on 200", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse({ status: "healthy", agentReady: true, uptime: 3600 }),
    );
    const result = await checkHealth({
      rawGatewayUrl: "http://localhost:18789",
      fetcher,
    });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.body.agentReady).toBe(true);
    }
    const fetchMock = fetcher.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://localhost:18789/api/health");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("treats a 503 as a structured error (callers may treat as unhealthy)", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse(
        { status: "unhealthy", reason: "workspace not loaded" },
        { status: 503 },
      ),
    );
    const result = await checkHealth({
      rawGatewayUrl: "http://localhost:18789",
      fetcher,
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.status).toBe(503);
    }
  });

  it("returns {kind: 'error', status: 404} when the endpoint isn't implemented yet (Ferenc-blocked path)", async () => {
    const fetcher = makeFetcher(
      () => new Response("Not Found", { status: 404 }),
    );
    const result = await checkHealth({
      rawGatewayUrl: "http://localhost:18789",
      fetcher,
    });
    expect(result).toEqual({ kind: "error", status: 404, message: undefined });
  });

  it("uses the spec's 5s default timeout", () => {
    expect(TIMEOUT_HEALTH_MS).toBe(5_000);
  });
});

describe("triggerReload", () => {
  it("calls POST /api/reload with reason + files", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse({ status: "reloaded", filesReloaded: ["TOOLS.md"] }),
    );
    const result = await triggerReload({
      rawGatewayUrl: "http://localhost:18789",
      reason: "integration_added",
      files: ["TOOLS.md", "openclaw.json"],
      fetcher,
    });
    expect(result.kind).toBe("ok");
    const fetchMock = fetcher.fetch as unknown as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body).toEqual({
      reason: "integration_added",
      files: ["TOOLS.md", "openclaw.json"],
    });
  });

  it("returns {kind: 'error', status: 409} when the agent is mid-task (deferred reload)", async () => {
    const fetcher = makeFetcher(() =>
      jsonResponse(
        { status: "deferred", message: "Agent is mid-task." },
        { status: 409 },
      ),
    );
    const result = await triggerReload({
      rawGatewayUrl: "http://localhost:18789",
      reason: "integration_added",
      files: [],
      fetcher,
    });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.status).toBe(409);
    }
  });

  it("uses the spec's 10s default timeout", () => {
    expect(TIMEOUT_RELOAD_MS).toBe(10_000);
  });
});
