export const supabaseDatabaseUrl = new sst.Secret(
  "AxelSaasSupabaseDatabaseUrl",
);
export const stripeSecretKey = new sst.Secret("AxelSaasStripeSecretKey");
export const stripeWebhookSecret = new sst.Secret(
  "AxelSaasStripeWebhookSecret",
);
export const resendApiKey = new sst.Secret("AxelSaasResendApiKey");
// OAuth client secrets — bind per stage. Defaults to empty so the
// integration service returns "not configured" instead of crashing when
// the secret is unset (e.g. previews).
export const googleOauthClientSecret = new sst.Secret(
  "AxelSaasGoogleOauthClientSecret",
);
export const slackOauthClientSecret = new sst.Secret(
  "AxelSaasSlackOauthClientSecret",
);
