import { describe, it, expect } from "vitest";
import {
  applyRateLimitHeaders,
  buildRateLimitedBody,
} from "../rateLimitHeaders";

function makeCtx() {
  return { set: { headers: {} as Record<string, string> } };
}

describe("applyRateLimitHeaders", () => {
  it("sets the standard X-RateLimit-* triplet on allowed responses", () => {
    const ctx = makeCtx();
    applyRateLimitHeaders(ctx, {
      allowed: true,
      limit: 10,
      remaining: 7,
      resetAt: 1_777_809_660,
      retryAfter: 30,
    });
    expect(ctx.set.headers["X-RateLimit-Limit"]).toBe("10");
    expect(ctx.set.headers["X-RateLimit-Remaining"]).toBe("7");
    expect(ctx.set.headers["X-RateLimit-Reset"]).toBe("1777809660");
    // Retry-After is omitted on allowed — only meaningful on 429.
    expect(ctx.set.headers["Retry-After"]).toBeUndefined();
  });

  it("adds Retry-After when blocked", () => {
    const ctx = makeCtx();
    applyRateLimitHeaders(ctx, {
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: 1_777_809_660,
      retryAfter: 25,
    });
    expect(ctx.set.headers["Retry-After"]).toBe("25");
    expect(ctx.set.headers["X-RateLimit-Remaining"]).toBe("0");
  });

  it("preserves existing headers (e.g. CORS / cache-control)", () => {
    const ctx = {
      set: {
        headers: { "Cache-Control": "no-store" } as Record<string, string>,
      },
    };
    applyRateLimitHeaders(ctx, {
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: 1,
      retryAfter: 1,
    });
    expect(ctx.set.headers["Cache-Control"]).toBe("no-store");
    expect(ctx.set.headers["X-RateLimit-Limit"]).toBe("5");
  });

  it("handles a context where set.headers is undefined", () => {
    const ctx: { set: { headers?: Record<string, string> } } = { set: {} };
    applyRateLimitHeaders(ctx, {
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: 1,
      retryAfter: 1,
    });
    expect(ctx.set.headers?.["X-RateLimit-Limit"]).toBe("5");
  });
});

describe("buildRateLimitedBody", () => {
  it("produces the standard 429 body shape", () => {
    const body = buildRateLimitedBody(
      {
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAt: 1_777_809_660,
        retryAfter: 25,
      },
      "Slow down — Axel needs a moment",
    );
    expect(body).toEqual({
      success: false,
      error: "rate_limited",
      message: "Slow down — Axel needs a moment",
      retryAfter: 25,
    });
  });
});
