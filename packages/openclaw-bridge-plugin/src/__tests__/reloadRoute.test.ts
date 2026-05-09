import { describe, expect, it } from "vitest";
import { makeReloadRouteHandler } from "../handlers/reloadRoute";
import {
  makeFakeRequest,
  makeFakeResponse,
  readJsonResponse,
} from "./testHelpers";

describe("makeReloadRouteHandler (MVP — 202 deferred)", () => {
  it("returns 202 deferred with the request reason and files echoed back", async () => {
    const handler = makeReloadRouteHandler();
    const req = makeFakeRequest({
      method: "POST",
      body: JSON.stringify({
        reason: "integration_added",
        files: ["TOOLS.md", "openclaw.json"],
      }),
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(202);
    expect(readJsonResponse(snap)).toMatchObject({
      status: "deferred",
      receivedReason: "integration_added",
      receivedFiles: ["TOOLS.md", "openclaw.json"],
    });
  });

  it("tolerates an empty body", async () => {
    const handler = makeReloadRouteHandler();
    const req = makeFakeRequest({ method: "POST", body: "" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    const snap = snapshot();
    expect(snap.statusCode).toBe(202);
    expect(readJsonResponse(snap)).toMatchObject({
      status: "deferred",
      receivedReason: null,
      receivedFiles: [],
    });
  });

  it("rejects non-POST with 405", async () => {
    const handler = makeReloadRouteHandler();
    const req = makeFakeRequest({ method: "GET" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(405);
  });

  it("returns 400 on invalid JSON", async () => {
    const handler = makeReloadRouteHandler();
    const req = makeFakeRequest({ method: "POST", body: "{not json" });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(400);
  });

  it("returns 413 when body exceeds the cap", async () => {
    const handler = makeReloadRouteHandler();
    const oversized = "x".repeat(2_000_000);
    const req = makeFakeRequest({
      method: "POST",
      body: oversized,
      chunkSize: 100_000,
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(413);
  });

  it("ignores wrong-typed `files` field", async () => {
    const handler = makeReloadRouteHandler();
    const req = makeFakeRequest({
      method: "POST",
      body: JSON.stringify({ reason: "x", files: "not-an-array" }),
    });
    const { res, snapshot } = makeFakeResponse();
    await handler(req, res);
    expect(snapshot().statusCode).toBe(202);
    expect(
      (readJsonResponse(snapshot()) as { receivedFiles: unknown[] })
        .receivedFiles,
    ).toEqual([]);
  });
});
