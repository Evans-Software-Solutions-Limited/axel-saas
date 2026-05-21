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
      },
    },
  },
});

// Resolve the openclaw apiCaller role ARN from the cross-stack SSM
// contract (`/axel/<stage>/openclaw/api-caller-role-arn`). On stages
// where the openclaw SST app hasn't been deployed yet, the parameter
// is absent and we skip the grant — the runtime returns 503 from the
// session endpoints in that case. Once the openclaw stack lands, a
// `sst deploy` of this app picks up the grant.
let openclawApiCallerRoleArn: string | null = null;
try {
  const param = await aws.ssm.getParameter({
    name: `/axel/${$app.stage}/openclaw/api-caller-role-arn`,
  });
  openclawApiCallerRoleArn = param.value ?? null;
} catch {
  // SSM parameter not found — openclaw stack not deployed on this stage.
}

coreAPI.route("$default", {
  // Linking the table grants the Lambda role `dynamodb:GetItem`,
  // `dynamodb:UpdateItem`, etc. on this table only — least-privilege by
  // default with no extra IAM wiring.
  link: [rateLimitsTable],
  handler: "microservices/core/src/api.handler",
  // sts:AssumeRole on the openclaw apiCaller role + read on the SSM
  // namespace that publishes the cross-stack contract. Without the
  // SSM read the loader cannot resolve cluster/task-def/etc; without
  // the AssumeRole the Lambda can't launch tasks even with the IDs.
  permissions: [
    {
      actions: ["ssm:GetParameter", "ssm:GetParameters"],
      resources: [`arn:aws:ssm:*:*:parameter/axel/${$app.stage}/openclaw/*`],
    },
    ...(openclawApiCallerRoleArn
      ? [
          {
            actions: ["sts:AssumeRole"],
            resources: [openclawApiCallerRoleArn],
          },
        ]
      : []),
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
