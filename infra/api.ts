import {
  supabaseDatabaseUrl,
  supabaseJwtSecret,
  stripeSecretKey,
  stripeWebhookSecret,
} from "./secrets";

export const coreAPI = new sst.aws.ApiGatewayV2("api-core");
export const otherServiceAPI = new sst.aws.ApiGatewayV2("api-other-service");

coreAPI.route("$default", {
  handler: "microservices/core/src/api.handler",
  environment: {
    DATABASE_URL: supabaseDatabaseUrl.value,
    JWT_SECRET: supabaseJwtSecret.value,
    STRIPE_SECRET_KEY: stripeSecretKey.value,
    STRIPE_WEBHOOK_SECRET: stripeWebhookSecret.value,
  },
});

otherServiceAPI.route("$default", {
  handler: "microservices/other-service/src/api.handler",
  environment: {
    DATABASE_URL: supabaseDatabaseUrl.value,
    JWT_SECRET: supabaseJwtSecret.value,
  },
});
