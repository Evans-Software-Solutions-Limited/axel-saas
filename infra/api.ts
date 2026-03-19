import { coreApiDomain, hostedZoneId, webOrigin } from "./domains";
import {
  supabaseDatabaseUrl,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./secrets";

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

coreAPI.route("$default", {
  handler: "microservices/core/src/api.handler",
  environment: {
    DATABASE_URL: supabaseDatabaseUrl.value,
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    STRIPE_SECRET_KEY: stripeSecretKey.value,
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret.value,
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER || "",
    STRIPE_PRICE_PRO: process.env.STRIPE_PRICE_PRO || "",
    STRIPE_PRICE_BUSINESS: process.env.STRIPE_PRICE_BUSINESS || "",
    STRIPE_PRICE_DEVELOPER: process.env.STRIPE_PRICE_DEVELOPER || "",
    NODE_ENV: process.env.NODE_ENV || "development",
    VITE_WEB_URL: process.env.VITE_WEB_URL || "http://localhost:5173",
  },
});
