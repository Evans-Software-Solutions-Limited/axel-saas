import { describe, expect, it } from "vitest";
import { makeUsageRouteHandler } from "../handlers/usageRoute";
import {
  makeFakeRequest,
  makeFakeResponse,
  readJsonResponse,
} from "./testHelpers";

describe("makeUsageRouteHandler (MVP — zero baseline)", () => {
  it("returns the gateway-contract usage shape with zero counters", async () => {
    const handler = makeUsageRouteHandler({ defaultModel: "anthropic/haiku" });
    const req = makeFakeRequest({ method: "GET" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(200);
    expect(readJsonResponse(snap)).toMatchObject({
      today: {
        inputTokens: 0,
        outputTokens: 0,
        model: "anthropic/haiku",
        requestCount: 0,
      },
      session: { inputTokens: 0, outputTokens: 0 },
      source: "bridge_zero_baseline",
    });
  });

  it("propagates the configured defaultModel into the today block", async () => {
    const handler = makeUsageRouteHandler({
      defaultModel: "openai/gpt-4o",
    });
    const req = makeFakeRequest({ method: "GET" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(
      (readJsonResponse(snapshot()) as { today: { model: string } }).today
        .model,
    ).toBe("openai/gpt-4o");
  });

  it("rejects non-GET with 405", async () => {
    const handler = makeUsageRouteHandler({ defaultModel: "x" });
    const req = makeFakeRequest({ method: "POST" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(405);
  });
});
