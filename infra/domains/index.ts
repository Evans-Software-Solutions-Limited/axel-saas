/**
 * Custom domain config per stage. Each account has its own Route 53 hosted zone;
 * deploy must run with credentials for the account that owns the zone.
 *
 * - Production (prod account): meetaxel.ai
 * - Staging (staging account): staging.meetaxel.ai
 * - Dev/personal (any other stage): no custom domain; frontend on localhost, API via Vite proxy.
 */
import {
  getDomainConfig,
  type DomainConfig,
} from "../../packages/api-utils/src/domains";

export type { DomainConfig };

const domainConfig = getDomainConfig($app.stage);

/** Public web hostname for deployed stages. Null for dev — no custom domain (localhost + proxy). */
export const webHost = domainConfig.webHost;

/** Core API custom domain for SST. Null for dev — no custom domain (API via proxy). */
export const coreApiDomain = domainConfig.apiHost;

/** Origin for CORS and FRONTEND_URL: https://{webHost} when deployed, null for dev (infra uses localhost fallback). */
export const webOrigin = webHost != null ? `https://${webHost}` : null;

/** Route 53 hosted zone ID for this stage (for ACM validation and alias records). Undefined for dev. */
export const hostedZoneId = domainConfig.zoneId;
