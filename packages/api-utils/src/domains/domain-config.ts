/**
 * Pure domain config logic (no SST globals). Used by infra at deploy time.
 * Testable without $app.stage.
 */
export const BASE_DOMAIN = "meetaxel.ai";

const ZONE_IDS: Record<string, string> = {
  staging: "Z0445995RJ5V60U79DR5",
  production: "Z00975242RQYVLZ1LRN73",
};

/** Route 53 hosted zone ID per environment. PR and QA use the QA zone. Dev/personal stages return undefined (no custom domain, use proxy/localhost). */
export function getHostedZoneId(stage: string): string | undefined {
  if (stage === "production") return ZONE_IDS.production;
  if (stage === "staging") return ZONE_IDS.staging;
  if (stage.startsWith("pr-") || stage.includes("qa")) return ZONE_IDS.qa;
  return undefined;
}

export interface DomainConfig {
  /** Public web hostname for deployed stages. Null for dev — no custom domain; frontend uses localhost and Vite proxy to the API. */
  webHost: string | null;
  /** API custom domain for SST. Null for dev — no custom domain; API is reached via localhost proxy in development. */
  apiHost: string | null;
  /** Route 53 hosted zone ID. Undefined for dev — no custom domain or DNS. */
  zoneId: string | undefined;
}

type Environment = "production" | "staging" | "dev";

const getEnvironment = (stage: string): Environment => {
  if (stage === "production") return "production";
  if (stage === "staging") return "staging";
  return "dev";
};

const getDeployedHosts = (
  environment: Exclude<Environment, "dev">,
): { webHost: string; apiHost: string } => {
  switch (environment) {
    case "production":
      return {
        webHost: BASE_DOMAIN,
        apiHost: `api.${BASE_DOMAIN}`,
      };
    case "staging":
      return {
        webHost: `staging.${BASE_DOMAIN}`,
        apiHost: `api.staging.${BASE_DOMAIN}`,
      };
  }
};

/**
 * Derives web host, API host, and Route 53 zone ID from the current stage.
 * Dev stages return null/undefined for all three — no custom domain; frontend
 * runs on localhost and uses the Vite proxy to reach the API.
 */
export function getDomainConfig(stage: string): DomainConfig {
  const environment = getEnvironment(stage);
  if (environment === "dev") {
    return { webHost: null, apiHost: null, zoneId: undefined };
  }
  const { webHost, apiHost } = getDeployedHosts(environment);
  return {
    webHost,
    apiHost,
    zoneId: getHostedZoneId(stage),
  };
}
