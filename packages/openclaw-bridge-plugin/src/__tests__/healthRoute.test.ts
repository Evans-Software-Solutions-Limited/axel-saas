/**
 * Tests for `GET /api/health`.
 *
 * The handler proxies OpenClaw's `/healthz` and reshapes the body to
 * the gateway-contract spec. We mock fetch so the test stays
 * hermetic (no live container required).
 */
import { describe, expect, it, vi } from "vitest";
import { makeHealthRouteHandler } from "../handlers/healthRoute";
import {
  makeFakeRequest,
  makeFakeResponse,
  readJsonResponse,
} from "./testHelpers";

const config = { chatCompletionsBaseUrl: "http://127.0.0.1:18789" };

function liveHealthzResponse(): Response {
  return new Response(JSON.stringify({ ok: true, status: "live" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("makeHealthRouteHandler", () => {
  it("returns 200 healthy when /healthz reports live", async () => {
    const fetcher = vi.fn().mockResolvedValue(liveHealthzResponse());
    const handler = makeHealthRouteHandler(config, {
      fetcher,
      startedAtMs: Date.now() - 5_000,
    });
    const req = makeFakeRequest({ method: "GET" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(200);
    const body = readJsonResponse(snap) as {
      status: string;
      agentReady: boolean;
      uptime: number;
    };
    expect(body.status).toBe("healthy");
    expect(body.agentReady).toBe(true);
    expect(body.uptime).toBeGreaterThanOrEqual(5);
  });

  it("calls the loopback /healthz endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(liveHealthzResponse());
    const handler = makeHealthRouteHandler(config, { fetcher });
    await handler(makeFakeRequest({ method: "GET" }), makeFakeResponse().res);
    const url = fetcher.mock.calls[0]![0];
    expect(String(url)).toBe("http://127.0.0.1:18789/healthz");
  });

  it("returns 503 unhealthy when /healthz returns non-2xx", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 500 }));
    const handler = makeHealthRouteHandler(config, { fetcher });
    const { res, snapshot } = makeFakeResponse();
    await handler(makeFakeRequest({ method: "GET" }), res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(503);
    const body = readJsonResponse(snap) as { reason: string };
    expect(body.reason).toMatch(/upstream.*500/);
  });

  it("returns 503 when /healthz body is unexpected", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ok: false }), { status: 200 }),
      );
    const handler = makeHealthRouteHandler(config, { fetcher });
    const { res, snapshot } = makeFakeResponse();
    await handler(makeFakeRequest({ method: "GET" }), res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(503);
    expect((readJsonResponse(snap) as { reason: string }).reason).toMatch(
      /unexpected.*body/,
    );
  });

  it("returns 503 when /healthz throws (network error)", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const handler = makeHealthRouteHandler(config, { fetcher });
    const { res, snapshot } = makeFakeResponse();
    await handler(makeFakeRequest({ method: "GET" }), res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(503);
    expect((readJsonResponse(snap) as { reason: string }).reason).toBe(
      "ECONNREFUSED",
    );
  });

  it("returns 503 with a timeout reason when /healthz aborts", async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const handler = makeHealthRouteHandler(config, { fetcher });
    const { res, snapshot } = makeFakeResponse();
    await handler(makeFakeRequest({ method: "GET" }), res);
    expect((readJsonResponse(snapshot()) as { reason: string }).reason).toMatch(
      /timed out/,
    );
  });

  it("returns 503 with a stringified non-Error rejection", async () => {
    const fetcher = vi.fn().mockRejectedValue("not-an-error-object");
    const handler = makeHealthRouteHandler(config, { fetcher });
    const { res, snapshot } = makeFakeResponse();
    await handler(makeFakeRequest({ method: "GET" }), res);
    expect((readJsonResponse(snapshot()) as { reason: string }).reason).toBe(
      "not-an-error-object",
    );
  });

  it("rejects non-GET methods with 405", async () => {
    const handler = makeHealthRouteHandler(config, {
      fetcher: vi.fn(),
    });
    const req = makeFakeRequest({ method: "POST" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(405);
  });
});
