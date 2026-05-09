/**
 * Tiny `node:http`-level helpers for plugin route handlers.
 *
 * The plugin SDK gives us bare `IncomingMessage`/`ServerResponse`
 * objects (no Express/Elysia abstraction). These helpers keep the
 * route handlers focused on shape translation rather than buffer
 * mechanics.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

const DEFAULT_BODY_LIMIT_BYTES = 1_048_576; // 1 MB — chat messages.

export interface ReadJsonOptions {
  /** Override the body size limit. Default: 1 MB. */
  maxBytes?: number;
}

export type ReadJsonResult =
  | { kind: "ok"; body: unknown }
  | { kind: "invalid_json"; message: string }
  | { kind: "too_large"; limit: number }
  | { kind: "stream_error"; message: string };

/**
 * Read and JSON-parse a request body, with a hard byte cap. Pure
 * promise (resolves with a tagged result), no thrown errors —
 * matches the result-type style used in the gateway client.
 */
export function readJsonBody(
  req: IncomingMessage,
  opts: ReadJsonOptions = {},
): Promise<ReadJsonResult> {
  const limit = opts.maxBytes ?? DEFAULT_BODY_LIMIT_BYTES;
  return new Promise<ReadJsonResult>((resolve) => {
    const chunks: Buffer[] = [];
    let received = 0;
    let settled = false;

    const settle = (value: ReadJsonResult): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    req.on("data", (chunk: Buffer | string) => {
      if (settled) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += buf.byteLength;
      if (received > limit) {
        settle({ kind: "too_large", limit });
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("error", (err: Error) => {
      settle({ kind: "stream_error", message: err.message });
    });
    req.on("end", () => {
      if (settled) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      if (raw.length === 0) {
        settle({ kind: "ok", body: {} });
        return;
      }
      try {
        settle({ kind: "ok", body: JSON.parse(raw) });
      } catch (err: unknown) {
        settle({
          kind: "invalid_json",
          message: err instanceof Error ? err.message : String(err),
        });
      }
    });
  });
}

/**
 * Write a JSON response. Sets `Content-Type: application/json` and a
 * `Content-Length` so HTTP/1.1 keep-alive plays nicely.
 */
export function writeJson(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = Buffer.from(JSON.stringify(body), "utf8");
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("content-length", payload.byteLength);
  res.end(payload);
}

/**
 * Pull `X-Request-Id` from inbound headers if the backend forwarded
 * one (PR #98 always does). Allows correlating traces across the
 * Axel ↔ OpenClaw boundary without inventing a new id.
 */
export function readRequestId(req: IncomingMessage): string | undefined {
  const raw = req.headers["x-request-id"];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return undefined;
}

/**
 * Forward the inbound `Authorization` header, if any. The plugin SDK
 * gives us "gateway" auth (the gateway already validated the bearer
 * token); we still pass it through to OpenClaw's chat-completions
 * endpoint because that endpoint enforces auth independently.
 */
export function readAuthorization(req: IncomingMessage): string | null {
  const raw = req.headers["authorization"];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return null;
}
