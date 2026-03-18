/**
 * Pure domain config logic (no SST globals). Used by infra at deploy time.
 * Testable without $app.stage.
 */
export const BASE_DOMAIN = "meetaxel.ai";

const ZONE_IDS: Record<string, string> = {
  staging: "Z04824262O09LOPK6FB4D",
  production: "Z017254226MJ1S00874V3",
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

type Environment = "production" | "staging" | "qa" | "dev";

const getEnvironment = (stage: string): Environment => {
  if (stage === "production") return "production";
  if (stage === "staging") return "staging";
  if (stage.startsWith("pr-") || stage.includes("qa")) return "qa";
  return "dev";
};

const getDeployedHosts = (
  environment: Exclude<Environment, "dev">,
  stage: string,
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
    case "qa":
      // PR stages: web = pr-N.qa..., api = pr-N.api.qa...
      // The api host uses pr-N.api.qa (not api.pr-N.qa) so that the single
      // wildcard *.api.qa.fdp.capitalpay.co.uk covers all PR OAuth callbacks
      // in WorkOS — WorkOS wildcards only match one subdomain level.
      if (stage.startsWith("pr-")) {
        return {
          webHost: `${stage}.qa.${BASE_DOMAIN}`,
          apiHost: `${stage}.api.qa.${BASE_DOMAIN}`,
        };
      }
      return {
        webHost: `qa.${BASE_DOMAIN}`,
        apiHost: `api.qa.${BASE_DOMAIN}`,
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
  const { webHost, apiHost } = getDeployedHosts(environment, stage);
  return {
    webHost,
    apiHost,
    zoneId: getHostedZoneId(stage),
  };
}
