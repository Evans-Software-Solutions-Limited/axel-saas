import { describe, it, expect } from "vitest";
import {
  RELEASE_EXPECTATION_COPY,
  WAITLIST_SECTION_ID,
  waitlistSignupHref,
} from "./waitlist";

describe("waitlist marketing helpers", () => {
  it("builds hash link to waitlist section", () => {
    expect(waitlistSignupHref()).toBe(`/#${WAITLIST_SECTION_ID}`);
  });

  it("includes tier query for API mapping", () => {
    expect(waitlistSignupHref("free")).toBe(
      `/?tier=free#${WAITLIST_SECTION_ID}`,
    );
    expect(waitlistSignupHref("pro")).toBe(`/?tier=pro#${WAITLIST_SECTION_ID}`);
    expect(waitlistSignupHref("enterprise")).toBe(
      `/?tier=enterprise#${WAITLIST_SECTION_ID}`,
    );
  });

  it("includes release expectation copy", () => {
    expect(RELEASE_EXPECTATION_COPY.length).toBeGreaterThan(10);
    expect(RELEASE_EXPECTATION_COPY).toMatch(/coming weeks/i);
  });
});
