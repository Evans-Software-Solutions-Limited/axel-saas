import { describe, expect, it } from "vitest";
import { BASE_DOMAIN, getDomainConfig, getHostedZoneId } from "./domain-config";

describe("domain-config", () => {
  describe("BASE_DOMAIN", () => {
    it("is fdp.capitalpay.co.uk", () => {
      expect(BASE_DOMAIN).toBe("fdp.capitalpay.co.uk");
    });
  });

  describe("getHostedZoneId", () => {
    it("returns production zone for production", () => {
      expect(getHostedZoneId("production")).toBe("Z017254226MJ1S00874V3");
    });

    it("returns staging zone for staging", () => {
      expect(getHostedZoneId("staging")).toBe("Z04824262O09LOPK6FB4D");
    });

    it("returns qa zone for qa", () => {
      expect(getHostedZoneId("qa")).toBe("Z06473683AMNBXZNMGPFB");
    });

    it("returns qa zone for pr-* stages", () => {
      expect(getHostedZoneId("pr-1")).toBe("Z06473683AMNBXZNMGPFB");
      expect(getHostedZoneId("pr-123")).toBe("Z06473683AMNBXZNMGPFB");
    });

    it("returns undefined for dev (no custom domain, uses proxy/localhost)", () => {
      expect(getHostedZoneId("dev")).toBeUndefined();
    });

    it("returns qa zone for stages containing 'qa'", () => {
      expect(getHostedZoneId("feature-qa")).toBe("Z06473683AMNBXZNMGPFB");
      expect(getHostedZoneId("my-qa-branch")).toBe("Z06473683AMNBXZNMGPFB");
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
      expect(config.zoneId).toBe("Z017254226MJ1S00874V3");
    });

    it("returns staging hostnames and zone for staging", () => {
      const config = getDomainConfig("staging");
      expect(config.webHost).toBe(`staging.${BASE_DOMAIN}`);
      expect(config.apiHost).toBe(`api.staging.${BASE_DOMAIN}`);
      expect(config.zoneId).toBe("Z04824262O09LOPK6FB4D");
    });

    it("returns qa hostnames and zone for qa stage", () => {
      const config = getDomainConfig("qa");
      expect(config.webHost).toBe(`qa.${BASE_DOMAIN}`);
      expect(config.apiHost).toBe(`api.qa.${BASE_DOMAIN}`);
      expect(config.zoneId).toBe("Z06473683AMNBXZNMGPFB");
    });

    it("returns qa web host and qa zone for stages containing 'qa' in name", () => {
      const config = getDomainConfig("feature-qa");
      expect(config.webHost).toBe(`qa.${BASE_DOMAIN}`);
      expect(config.apiHost).toBe(`api.qa.${BASE_DOMAIN}`);
      expect(config.zoneId).toBe("Z06473683AMNBXZNMGPFB");
    });

    it("returns pr-N.qa web host and pr-N.api.qa API host for pr-* stages", () => {
      const config = getDomainConfig("pr-5");
      expect(config.webHost).toBe(`pr-5.qa.${BASE_DOMAIN}`);
      // API host is pr-N.api.qa (not api.pr-N.qa) so *.api.qa.* wildcard covers all PRs in WorkOS
      expect(config.apiHost).toBe(`pr-5.api.qa.${BASE_DOMAIN}`);
      expect(config.zoneId).toBe("Z06473683AMNBXZNMGPFB");
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
