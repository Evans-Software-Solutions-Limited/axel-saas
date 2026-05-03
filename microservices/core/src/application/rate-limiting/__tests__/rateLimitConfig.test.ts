import { describe, it, expect } from "vitest";
import {
  BUCKET_TTL_SECONDS,
  WINDOW_SECONDS,
  getRateLimit,
} from "../rateLimitConfig";

describe("getRateLimit", () => {
  it("returns the chat limits per tier (free=10, premium=30, enterprise=30)", () => {
    expect(getRateLimit("chat", "free")).toBe(10);
    expect(getRateLimit("chat", "premium")).toBe(30);
    expect(getRateLimit("chat", "enterprise")).toBe(30);
  });

  it("returns the write limits per tier (5/5/5 — credential ops are tier-flat)", () => {
    expect(getRateLimit("write", "free")).toBe(5);
    expect(getRateLimit("write", "premium")).toBe(5);
    expect(getRateLimit("write", "enterprise")).toBe(5);
  });

  it("returns the read limits per tier (free=60, premium=120, enterprise=120)", () => {
    expect(getRateLimit("read", "free")).toBe(60);
    expect(getRateLimit("read", "premium")).toBe(120);
    expect(getRateLimit("read", "enterprise")).toBe(120);
  });

  it("treats a null tier as free (defensive — same as the token-management gate)", () => {
    // A user mid-signup before the free row is provisioned has tier=null;
    // they shouldn't get unlimited access just because the row's missing.
    expect(getRateLimit("chat", null)).toBe(10);
    expect(getRateLimit("write", null)).toBe(5);
    expect(getRateLimit("read", null)).toBe(60);
  });
});

describe("WINDOW_SECONDS", () => {
  it("is 60s — fixed minute-aligned window", () => {
    expect(WINDOW_SECONDS).toBe(60);
  });
});

describe("BUCKET_TTL_SECONDS", () => {
  it("is longer than the window (covers DDB TTL eventual-consistency lag)", () => {
    expect(BUCKET_TTL_SECONDS).toBeGreaterThan(WINDOW_SECONDS);
  });
});
