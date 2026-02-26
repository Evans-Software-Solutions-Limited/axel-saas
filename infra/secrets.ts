export const supabaseDatabaseUrl = new sst.Secret(
  "AxelSaasSupabaseDatabaseUrl",
);
export const stripeSecretKey = new sst.Secret("AxelSaasStripeSecretKey");
export const stripeWebhookSecret = new sst.Secret(
  "AxelSaasStripeWebhookSecret",
);
