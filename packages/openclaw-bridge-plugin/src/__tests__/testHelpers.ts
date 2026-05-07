/**
 * Lightweight `node:http` test doubles.
 *
 * `makeFakeRequest` synthesises an `IncomingMessage`-shaped object
 * that emits `data` / `end` events for a body string. `makeFakeResponse`
 * captures `statusCode`, headers, and the final body.
 *
 * The route handler only touches a small subset of the Node http
 * interface (`method`, `headers`, `on`, `destroy` for incoming;
 * `statusCode`, `setHeader`, `end` for outgoing), so a tiny shim is
 * cheaper and faster than spinning up a real `http.Server` per test.
 */
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface FakeRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** Force a stream error after `errorAfterMs`. */
  errorAfterMs?: number;
  /** Emit data in chunks of this size to test the body limit cap. */
  chunkSize?: number;
}

/**
 * Build a Readable that quacks like an IncomingMessage for our
 * helpers' purposes. Casts to IncomingMessage at the boundary — the
 * production code only reads `method`, `headers`, and pipes from
 * `data`/`end`/`error`/`destroy` so the cast is safe.
 */
export function makeFakeRequest(
  opts: FakeRequestOptions = {},
): IncomingMessage {
  const body = opts.body ?? "";
  const chunkSize = opts.chunkSize ?? body.length;
  const chunks: string[] = [];
  if (body.length === 0) {
    // Readable.from with empty array still emits `end`.
  } else {
    for (let i = 0; i < body.length; i += chunkSize) {
      chunks.push(body.slice(i, i + chunkSize));
    }
  }
  const stream = Readable.from(chunks) as unknown as IncomingMessage;
  stream.method = opts.method ?? "GET";
  stream.headers = opts.headers ?? {};
  if (opts.errorAfterMs !== undefined) {
    setTimeout(
      () => stream.emit("error", new Error("simulated stream error")),
      opts.errorAfterMs,
    );
  }
  return stream;
}

export interface FakeResponseSnapshot {
  statusCode: number;
  headers: Record<string, string | number | string[]>;
  body: string;
  ended: boolean;
}

/** Captures every interaction the route handler performs. */
export function makeFakeResponse(): {
  res: ServerResponse;
  snapshot: () => FakeResponseSnapshot;
} {
  const headers: Record<string, string | number | string[]> = {};
  const bodyChunks: Buffer[] = [];
  let statusCode = 200;
  let ended = false;

  const res = {
    get statusCode() {
      return statusCode;
    },
    set statusCode(v: number) {
      statusCode = v;
    },
    setHeader(name: string, value: string | number | string[]) {
      headers[name.toLowerCase()] = value;
    },
    end(chunk?: Buffer | string) {
      if (chunk !== undefined) {
        bodyChunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8"),
        );
      }
      ended = true;
    },
  } as unknown as ServerResponse;

  return {
    res,
    snapshot: () => ({
      statusCode,
      headers,
      body: Buffer.concat(bodyChunks).toString("utf8"),
      ended,
    }),
  };
}

/**
 * Convenience for the common case: parse the captured body as JSON.
 * Throws (test failure) if body isn't JSON — that's the assertion
 * we care about anyway.
 */
export function readJsonResponse(snap: FakeResponseSnapshot): unknown {
  return JSON.parse(snap.body);
}
