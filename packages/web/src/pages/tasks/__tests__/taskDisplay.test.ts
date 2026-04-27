import { describe, it, expect, vi, afterEach } from "vitest";
import { STATUS_COLOURS, STATUS_LABELS, formatRelative } from "../taskDisplay";

afterEach(() => {
  vi.useRealTimers();
});

describe("STATUS_COLOURS / STATUS_LABELS", () => {
  it("covers every TaskState value", () => {
    const states = [
      "running",
      "completed",
      "failed",
      "review_ready",
      "no_changes",
      "unknown",
    ] as const;
    for (const s of states) {
      expect(STATUS_COLOURS[s]).toBeTruthy();
      expect(STATUS_LABELS[s]).toBeTruthy();
    }
  });
});

describe("formatRelative", () => {
  const FIXED_NOW = new Date("2026-04-22T12:00:00Z");

  it("returns em dash for null/undefined", () => {
    expect(formatRelative(null)).toBe("—");
    expect(formatRelative(undefined)).toBe("—");
  });

  it("returns 'Just now' for sub-minute deltas", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const iso = new Date(FIXED_NOW.getTime() - 30_000).toISOString();
    expect(formatRelative(iso)).toBe("Just now");
  });

  it("renders minutes when under an hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const iso = new Date(FIXED_NOW.getTime() - 5 * 60_000).toISOString();
    expect(formatRelative(iso)).toBe("5 min ago");
  });

  it("renders hours when under a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const iso = new Date(FIXED_NOW.getTime() - 3 * 60 * 60_000).toISOString();
    expect(formatRelative(iso)).toBe("3 hr ago");
  });

  it("renders days for older timestamps with correct pluralisation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const oneDay = new Date(
      FIXED_NOW.getTime() - 1 * 24 * 60 * 60_000,
    ).toISOString();
    const fiveDays = new Date(
      FIXED_NOW.getTime() - 5 * 24 * 60 * 60_000,
    ).toISOString();
    expect(formatRelative(oneDay)).toBe("1 day ago");
    expect(formatRelative(fiveDays)).toBe("5 days ago");
  });
});
