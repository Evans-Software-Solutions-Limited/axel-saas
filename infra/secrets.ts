export const supabaseDatabaseUrl = new sst.Secret(
  "AxelSaasSupabaseDatabaseUrl",
);
export const supabaseJwtSecret = new sst.Secret("AxelSaasJwtSecret");
export const stripeSecretKey = new sst.Secret("AxelSaasStripeSecretKey");
export const stripeWebhookSecret = new sst.Secret(
  "AxelSaasStripeWebhookSecret",
);
