import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIER,
  getTierPolicy,
  mapTierForOpenclaw,
  resolveTier,
} from "../tierPolicy";

describe("tierPolicy", () => {
  describe("getTierPolicy", () => {
    it("returns the free-tier defaults", () => {
      const p = getTierPolicy("free");
      expect(p.maxConcurrentSessions).toBe(1);
      expect(p.cpu).toBe(512);
      expect(p.memoryMib).toBe(1024);
      expect(p.wallClockMs).toBe(60 * 60 * 1000);
      expect(p.taskDefinitionKey).toBe("free");
    });

    it("returns the premium-tier defaults", () => {
      const p = getTierPolicy("premium");
      expect(p.maxConcurrentSessions).toBe(2);
      expect(p.cpu).toBe(1024);
      expect(p.memoryMib).toBe(2048);
      expect(p.wallClockMs).toBe(8 * 60 * 60 * 1000);
      expect(p.taskDefinitionKey).toBe("premium");
    });

    it("returns the enterprise-tier defaults", () => {
      const p = getTierPolicy("enterprise");
      expect(p.maxConcurrentSessions).toBe(10);
      expect(p.cpu).toBe(2048);
      expect(p.memoryMib).toBe(4096);
      expect(p.wallClockMs).toBe(24 * 60 * 60 * 1000);
      expect(p.taskDefinitionKey).toBe("enterprise");
    });

    it("wall-clock caps are strictly increasing across tiers", () => {
      expect(getTierPolicy("free").wallClockMs).toBeLessThan(
        getTierPolicy("premium").wallClockMs,
      );
      expect(getTierPolicy("premium").wallClockMs).toBeLessThan(
        getTierPolicy("enterprise").wallClockMs,
      );
    });
  });

  describe("mapTierForOpenclaw", () => {
    it("is identity for the supported tiers", () => {
      // Identity for now; the indirection exists so a future OpenClaw
      // vocabulary drift lands as a one-file change.
      expect(mapTierForOpenclaw("free")).toBe("free");
      expect(mapTierForOpenclaw("premium")).toBe("premium");
      expect(mapTierForOpenclaw("enterprise")).toBe("enterprise");
    });
  });

  describe("resolveTier", () => {
    it("returns the explicit tier when supplied", () => {
      expect(resolveTier("premium")).toBe("premium");
      expect(resolveTier("free")).toBe("free");
      expect(resolveTier("enterprise")).toBe("enterprise");
    });

    it("falls back to free when null", () => {
      expect(resolveTier(null)).toBe(DEFAULT_TIER);
      expect(resolveTier(null)).toBe("free");
    });

    it("falls back to free when undefined", () => {
      expect(resolveTier(undefined)).toBe("free");
    });
  });
});
