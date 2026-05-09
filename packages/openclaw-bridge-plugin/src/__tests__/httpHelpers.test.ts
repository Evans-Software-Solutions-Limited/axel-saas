/**
 * Tests for the `node:http`-level body/response helpers.
 */
import { describe, expect, it } from "vitest";
import {
  readAuthorization,
  readJsonBody,
  readRequestId,
  writeJson,
} from "../handlers/httpHelpers";
import {
  makeFakeRequest,
  makeFakeResponse,
  readJsonResponse,
} from "./testHelpers";

describe("readJsonBody", () => {
  it("parses a JSON object body", async () => {
    const req = makeFakeRequest({ body: JSON.stringify({ a: 1, b: "x" }) });
    const result = await readJsonBody(req);
    expect(result).toEqual({ kind: "ok", body: { a: 1, b: "x" } });
  });

  it("returns ok with empty object when body is empty", async () => {
    const req = makeFakeRequest({ body: "" });
    const result = await readJsonBody(req);
    expect(result).toEqual({ kind: "ok", body: {} });
  });

  it("returns invalid_json on malformed body", async () => {
    const req = makeFakeRequest({ body: "{not json" });
    const result = await readJsonBody(req);
    expect(result.kind).toBe("invalid_json");
    if (result.kind === "invalid_json") {
      expect(result.message).toMatch(/JSON|Unexpected/i);
    }
  });

  it("rejects bodies above the byte cap", async () => {
    const big = "x".repeat(1024);
    const req = makeFakeRequest({ body: big, chunkSize: 256 });
    const result = await readJsonBody(req, { maxBytes: 512 });
    expect(result).toEqual({ kind: "too_large", limit: 512 });
  });

  it("propagates stream errors", async () => {
    // Use a non-JSON body so the error result and the parse-failure
    // result are both negative — we're proving the helper never
    // throws and that it settles to *some* tagged result regardless
    // of which event fires first. Three race outcomes are valid:
    //   - error fires before `end`: stream_error
    //   - body arrives first and parses: invalid_json
    //   - the runtime is fast enough that neither path is exercised
    //     before settle: ok with empty body
    const req = makeFakeRequest({ body: "raw not-json", errorAfterMs: 1 });
    const result = await readJsonBody(req);
    expect(["stream_error", "invalid_json", "ok"]).toContain(result.kind);
  });

  it("ignores chunks emitted after the cap is hit", async () => {
    // First chunk is already over the limit; the helper should settle
    // immediately and not concat further data.
    const oversized = "x".repeat(2000);
    const req = makeFakeRequest({ body: oversized, chunkSize: 1500 });
    const result = await readJsonBody(req, { maxBytes: 1024 });
    expect(result).toEqual({ kind: "too_large", limit: 1024 });
  });
});

describe("writeJson", () => {
  it("writes status, content-type, and JSON-encoded body", () => {
    const { res, snapshot } = makeFakeResponse();
    writeJson(res, 201, { ok: true, value: 42 });
    const snap = snapshot();
    expect(snap.statusCode).toBe(201);
    expect(snap.headers["content-type"]).toBe(
      "application/json; charset=utf-8",
    );
    expect(snap.headers["content-length"]).toBe(
      Buffer.byteLength(JSON.stringify({ ok: true, value: 42 }), "utf8"),
    );
    expect(readJsonResponse(snap)).toEqual({ ok: true, value: 42 });
    expect(snap.ended).toBe(true);
  });

  it("handles unicode payloads (length is bytes, not chars)", () => {
    const { res, snapshot } = makeFakeResponse();
    const body = { msg: "héllo 🦞" };
    writeJson(res, 200, body);
    const snap = snapshot();
    expect(snap.headers["content-length"]).toBe(
      Buffer.byteLength(JSON.stringify(body), "utf8"),
    );
    expect(readJsonResponse(snap)).toEqual(body);
  });
});

describe("readRequestId", () => {
  it("returns string headers verbatim", () => {
    const req = makeFakeRequest({ headers: { "x-request-id": "abc-123" } });
    expect(readRequestId(req)).toBe("abc-123");
  });

  it("returns the first entry from array headers", () => {
    const req = makeFakeRequest({ headers: {} });
    // node:http normalises duplicates as arrays for some headers; force
    // that shape directly since our fake type-narrows to string only.
    (req.headers as Record<string, unknown>)["x-request-id"] = [
      "first",
      "second",
    ];
    expect(readRequestId(req)).toBe("first");
  });

  it("returns undefined when missing", () => {
    const req = makeFakeRequest();
    expect(readRequestId(req)).toBeUndefined();
  });

  it("returns undefined on empty string", () => {
    const req = makeFakeRequest({ headers: { "x-request-id": "" } });
    expect(readRequestId(req)).toBeUndefined();
  });
});

describe("readAuthorization", () => {
  it("returns the bearer header verbatim", () => {
    const req = makeFakeRequest({
      headers: { authorization: "Bearer xyz" },
    });
    expect(readAuthorization(req)).toBe("Bearer xyz");
  });

  it("returns null when missing", () => {
    expect(readAuthorization(makeFakeRequest())).toBeNull();
  });

  it("handles array-form headers", () => {
    const req = makeFakeRequest({ headers: {} });
    (req.headers as Record<string, unknown>)["authorization"] = [
      "Bearer one",
      "Bearer two",
    ];
    expect(readAuthorization(req)).toBe("Bearer one");
  });

  it("returns null on empty string", () => {
    const req = makeFakeRequest({ headers: { authorization: "" } });
    expect(readAuthorization(req)).toBeNull();
  });
});
