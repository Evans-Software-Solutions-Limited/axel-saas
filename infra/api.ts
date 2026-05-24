import { coreApiDomain, hostedZoneId, webOrigin } from "./domains";
import {
  supabaseDatabaseUrl,
  supabaseServiceRoleKey,
  stripeSecretKey,
  stripeWebhookSecret,
  resendApiKey,
  googleOauthClientSecret,
  slackOauthClientSecret,
} from "./secrets";
import { rateLimitsTable } from "./storage";

export const coreAPI = new sst.aws.ApiGatewayV2("api-core", {
  domain:
    coreApiDomain != null
      ? {
          name: coreApiDomain,
          ...(hostedZoneId && { dns: sst.aws.dns({ zone: hostedZoneId }) }),
        }
      : undefined,
  cors:
    webOrigin != null
      ? {
          allowOrigins: [webOrigin],
          allowCredentials: true,
          allowHeaders: ["Content-Type", "Authorization"],
          allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        }
      : false,
  transform: {
    route: {
      handler: (args) => {
        args.runtime ??= "nodejs22.x";
        // POST /openclaw/sessions polls DescribeTasks for up to ~22s
        // for the ENI attach plus several seconds of TG + listener
        // rule wiring. The Lambda default (20s) cuts it close on
        // warm bring-ups and breaks on slow paths. 60s leaves
        // headroom for the ENI poll to complete in-process even
        // when API Gateway has already 504'd the client at its 30s
        // integration cap — keeping the row + AWS resources
        // consistent so the user's retry idempotently returns the
        // running session per spec §7.1.
        args.timeout ??= "60 seconds";
      },
    },
  },
});

coreAPI.route("$default", {
  // Linking the table grants the Lambda role `dynamodb:GetItem`,
  // `dynamodb:UpdateItem`, etc. on this table only — least-privilege by
  // default with no extra IAM wiring.
  link: [rateLimitsTable],
  handler: "microservices/core/src/api.handler",
  // Permissions for the openclaw session-lifecycle integration:
  //
  //   1. ssm:GetParameter on the openclaw cross-stack contract
  //      namespace — the Lambda reads cluster ARN, task-def ARNs,
  //      subnets, etc. at boot via getOpenclawInfra().
  //   2. sts:AssumeRole on the openclaw apiCaller role by NAME
  //      PATTERN (`openclaw-<stage>-api-caller`). The openclaw SST
  //      app (apps/openclaw/infra/apiCaller.ts) registers exactly
  //      that name, so the wildcard matches the one real role per
  //      stage. The role's own trust policy is the actual
  //      authorisation gate (account-root + explicit grant) — this
  //      grant just lets the Lambda attempt the assume.
  //
  // Why the name pattern instead of resolving the exact ARN at
  // deploy time: the deploy-time resolve required `aws.ssm.
  // getParameter` (a Pulumi data source), which:
  //   - bound this stack's deploy to the openclaw stack already
  //     being deployed first (violating the spec §4.3 spirit of
  //     "runtime-only cross-stack reads"), and
  //   - was fragile to the Pulumi provider's error-message wording
  //     changing — every "openclaw not yet deployed" path required
  //     a substring match against an undocumented error format.
  // The name-pattern grant is declarative and self-contained: this
  // stack deploys clean on any stage regardless of whether openclaw
  // is up, and the runtime endpoints return 503 (dns_unavailable)
  // gracefully until openclaw is present.
  permissions: [
    {
      actions: ["ssm:GetParameter", "ssm:GetParameters"],
      resources: [`arn:aws:ssm:*:*:parameter/axel/${$app.stage}/openclaw/*`],
    },
    {
      actions: ["sts:AssumeRole"],
      resources: [`arn:aws:iam::*:role/openclaw-${$app.stage}-api-caller`],
    },
  ],
  environment: {
    DATABASE_URL: supabaseDatabaseUrl.value,
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey.value,
    STRIPE_SECRET_KEY: stripeSecretKey.value,
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret.value,
    STRIPE_PRICE_PREMIUM: process.env.STRIPE_PRICE_PREMIUM || "",
    RESEND_API_KEY: resendApiKey.value,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || "",
    // Read by emailTemplates.ts and waitlistEmail.ts to build CTA and
    // unsubscribe links. Without these, every staging/preview email would
    // link back to the production hardcoded defaults.
    APP_URL: process.env.APP_URL || "",
    MARKETING_URL: process.env.MARKETING_URL || "",
    NODE_ENV: process.env.NODE_ENV || "development",
    VITE_WEB_URL: process.env.VITE_WEB_URL || "http://localhost:5173",
    // Public-facing base URL of this API. Used by the integrations OAuth
    // flow to register the callback redirect_uri with providers — must
    // match exactly what's registered in the Google / Slack app consoles.
    API_BASE_URL: process.env.API_BASE_URL || "",
    // Integrations OAuth client credentials. Client IDs are not secrets
    // (they're embedded in redirect URLs) so they ride env directly;
    // secrets come through SST.
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    GOOGLE_OAUTH_CLIENT_SECRET: googleOauthClientSecret.value,
    SLACK_OAUTH_CLIENT_ID: process.env.SLACK_OAUTH_CLIENT_ID || "",
    SLACK_OAUTH_CLIENT_SECRET: slackOauthClientSecret.value,
    // DynamoDB table backing the per-user rate limiter. Bound here so
    // the rate-limit client doesn't have to re-derive it from sst
    // resource bindings at runtime.
    RATE_LIMITS_TABLE: rateLimitsTable.name,
    // Stage name surfaced to runtime so the openclaw SSM contract
    // loader can build its `/axel/<stage>/openclaw/*` prefix without
    // a second deploy-time injection.
    STAGE: $app.stage,
    // Optional shared token for the bridge plugin's auth: "gateway"
    // routes. When set, the openclaw service injects it into every
    // task via `OPENCLAW_GATEWAY_TOKEN` so the core API and the
    // task agree on the bearer.
    OPENCLAW_GATEWAY_TOKEN: process.env.OPENCLAW_GATEWAY_TOKEN || "",
  },
});
