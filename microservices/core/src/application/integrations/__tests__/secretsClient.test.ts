import { describe, it, expect } from "vitest";
import { buildSecretPath, computeKeyHint } from "../secretsClient";

describe("secretsClient", () => {
  describe("buildSecretPath", () => {
    it("builds canonical path for user + integration", () => {
      const path = buildSecretPath("user-123", "openai");
      expect(path).toBe(
        "/axel-saas/users/user-123/integrations/openai/credential",
      );
    });

    it("handles telegram-bot integration ID", () => {
      const path = buildSecretPath("user-456", "telegram-bot");
      expect(path).toBe(
        "/axel-saas/users/user-456/integrations/telegram-bot/credential",
      );
    });

    it("includes user ID in path for per-user scoping", () => {
      const path1 = buildSecretPath("user-a", "openai");
      const path2 = buildSecretPath("user-b", "openai");
      expect(path1).not.toBe(path2);
      expect(path1).toContain("user-a");
      expect(path2).toContain("user-b");
    });
  });

  describe("computeKeyHint", () => {
    it("returns last 4 chars for keys >= 8 chars", () => {
      expect(computeKeyHint("sk-abcdefghijkl")).toBe("...ijkl");
    });

    it("returns masked hint for short keys", () => {
      expect(computeKeyHint("abc")).toBe("••••");
    });

    it("returns last 4 chars for exactly 8 char key", () => {
      expect(computeKeyHint("12345678")).toBe("...5678");
    });

    it("returns masked hint for 7 char key", () => {
      expect(computeKeyHint("1234567")).toBe("••••");
    });

    it("never returns the full key", () => {
      const key = "sk-proj-abc123def456";
      const hint = computeKeyHint(key);
      expect(hint.length).toBeLessThan(key.length);
      expect(hint).not.toBe(key);
      expect(key.startsWith(hint)).toBe(false);
    });
  });
});
