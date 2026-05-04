import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateGatewayUrl } from "../gatewayUrl";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe("validateGatewayUrl", () => {
  describe("non-production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "development";
    });

    it("accepts HTTPS URLs", () => {
      expect(validateGatewayUrl("https://gateway.example.com:18789")).toBe(
        "https://gateway.example.com:18789/",
      );
    });

    it("accepts HTTP URLs (dev convenience)", () => {
      expect(validateGatewayUrl("http://localhost:18789")).toBe(
        "http://localhost:18789/",
      );
    });

    it("accepts loopback hostnames (dev convenience)", () => {
      expect(validateGatewayUrl("http://127.0.0.1:18789")).toBe(
        "http://127.0.0.1:18789/",
      );
    });
  });

  describe("production", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("accepts a public HTTPS URL", () => {
      expect(validateGatewayUrl("https://gw.openclaw.meetaxel.ai")).toBe(
        "https://gw.openclaw.meetaxel.ai/",
      );
    });

    it("rejects HTTP", () => {
      expect(validateGatewayUrl("http://gw.openclaw.meetaxel.ai")).toBeNull();
    });

    it("rejects loopback hostnames", () => {
      expect(validateGatewayUrl("https://localhost")).toBeNull();
      expect(validateGatewayUrl("https://127.0.0.1")).toBeNull();
    });

    it("rejects RFC1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)", () => {
      expect(validateGatewayUrl("https://10.0.0.5")).toBeNull();
      expect(validateGatewayUrl("https://192.168.1.1")).toBeNull();
      // 172.16-172.31 are private; 172.15 and 172.32 are public.
      expect(validateGatewayUrl("https://172.16.0.1")).toBeNull();
      expect(validateGatewayUrl("https://172.31.255.254")).toBeNull();
      expect(validateGatewayUrl("https://172.15.0.1")).not.toBeNull();
      expect(validateGatewayUrl("https://172.32.0.1")).not.toBeNull();
    });
  });

  describe("malformed input", () => {
    it("returns null for a non-URL string", () => {
      expect(validateGatewayUrl("not a url")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(validateGatewayUrl("")).toBeNull();
    });
  });
});
