import { describe, it, expect } from "vitest";
import { validateSessionName } from "../nameValidation";

describe("validateSessionName", () => {
  describe("happy path", () => {
    it("accepts a simple lowercase name", () => {
      expect(validateSessionName("demo")).toEqual({ valid: true });
    });

    it("accepts digits and hyphens in the middle", () => {
      expect(validateSessionName("my-workspace-1")).toEqual({ valid: true });
      expect(validateSessionName("a1b2")).toEqual({ valid: true });
    });

    it("accepts the minimum length (3)", () => {
      expect(validateSessionName("abc")).toEqual({ valid: true });
    });

    it("accepts the maximum length (63)", () => {
      const name = "a" + "b".repeat(61) + "c"; // 63 chars
      expect(validateSessionName(name)).toEqual({ valid: true });
    });
  });

  describe("type guard", () => {
    it("rejects non-string input", () => {
      expect(validateSessionName(undefined)).toEqual({
        valid: false,
        reason: "Name must be a string",
      });
      expect(validateSessionName(null)).toEqual({
        valid: false,
        reason: "Name must be a string",
      });
      expect(validateSessionName(123)).toEqual({
        valid: false,
        reason: "Name must be a string",
      });
    });
  });

  describe("length bounds", () => {
    it("rejects names shorter than 3 chars", () => {
      const r = validateSessionName("ab");
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reason).toContain("3");
    });

    it("rejects names longer than 63 chars", () => {
      const r = validateSessionName("a".repeat(64));
      expect(r.valid).toBe(false);
    });
  });

  describe("charset", () => {
    it("rejects uppercase letters", () => {
      const r = validateSessionName("MyWorkspace");
      expect(r.valid).toBe(false);
    });

    it("rejects underscores", () => {
      const r = validateSessionName("my_workspace");
      expect(r.valid).toBe(false);
    });

    it("rejects spaces", () => {
      const r = validateSessionName("my workspace");
      expect(r.valid).toBe(false);
    });

    it("rejects unicode", () => {
      const r = validateSessionName("café-1");
      expect(r.valid).toBe(false);
    });
  });

  describe("edge characters", () => {
    it("rejects leading hyphen", () => {
      expect(validateSessionName("-demo").valid).toBe(false);
    });

    it("rejects trailing hyphen", () => {
      expect(validateSessionName("demo-").valid).toBe(false);
    });

    it("rejects all-hyphen names", () => {
      expect(validateSessionName("---").valid).toBe(false);
    });
  });

  describe("reserved blocklist", () => {
    it.each([
      "admin",
      "api",
      "auth",
      "www",
      "app",
      "mail",
      "health",
      "openclaw",
      "axel",
      "root",
      "test",
      "staging",
      "production",
    ])("rejects exact reserved name %s", (name) => {
      expect(validateSessionName(name).valid).toBe(false);
    });

    it("rejects names starting with axel-", () => {
      const r = validateSessionName("axel-demo");
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reason).toContain("axel-");
    });

    it("allows names containing 'axel' but not as prefix", () => {
      // "demo-axel" doesn't start with "axel-" so it's allowed
      expect(validateSessionName("demo-axel").valid).toBe(true);
    });
  });
});
