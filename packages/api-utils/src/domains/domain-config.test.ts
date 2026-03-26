import { describe, expect, it } from "vitest";
import { BASE_DOMAIN, getDomainConfig, getHostedZoneId } from "./domain-config";

describe("domain-config", () => {
  describe("BASE_DOMAIN", () => {
    it("is meetaxel.ai", () => {
      expect(BASE_DOMAIN).toBe("meetaxel.ai");
    });
  });

  describe("getHostedZoneId", () => {
    it("returns production zone for production", () => {
      expect(getHostedZoneId("production")).toBe("Z00975242RQYVLZ1LRN73");
    });

    it("returns staging zone for staging", () => {
      expect(getHostedZoneId("staging")).toBe("Z0445995RJ5V60U79DR5");
    });

    it("returns undefined for dev (no custom domain, uses proxy/localhost)", () => {
      expect(getHostedZoneId("dev")).toBeUndefined();
    });

    it("returns undefined for personal/developer stage names (default, no custom domain)", () => {
      expect(getHostedZoneId("brad")).toBeUndefined();
      expect(getHostedZoneId("bradleysimms-evans")).toBeUndefined();
      expect(getHostedZoneId("alice")).toBeUndefined();
    });
  });

  describe("getDomainConfig", () => {
    it("returns production hostnames and zone for production", () => {
      const config = getDomainConfig("production");
      expect(config.webHost).toBe(BASE_DOMAIN);
      expect(config.apiHost).toBe(`api.${BASE_DOMAIN}`);
      expect(config.zoneId).toBe("Z00975242RQYVLZ1LRN73");
    });

    it("returns staging hostnames and zone for staging", () => {
      const config = getDomainConfig("staging");
      expect(config.webHost).toBe(`staging.${BASE_DOMAIN}`);
      expect(config.apiHost).toBe(`api.staging.${BASE_DOMAIN}`);
      expect(config.zoneId).toBe("Z0445995RJ5V60U79DR5");
    });

    it("returns null for all fields for dev stage", () => {
      const config = getDomainConfig("dev");
      expect(config.webHost).toBeNull();
      expect(config.apiHost).toBeNull();
      expect(config.zoneId).toBeUndefined();
    });

    it("returns null for all fields for any personal/developer stage", () => {
      const config = getDomainConfig("bradleysimms-evans");
      expect(config.webHost).toBeNull();
      expect(config.apiHost).toBeNull();
      expect(config.zoneId).toBeUndefined();
    });

    it("returns api.{env}.domain for stable deployed stages", () => {
      expect(getDomainConfig("production").apiHost).toBe(`api.${BASE_DOMAIN}`);
      expect(getDomainConfig("staging").apiHost).toBe(
        `api.staging.${BASE_DOMAIN}`,
      );
    });
  });
});
