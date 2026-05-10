export const supabaseDatabaseUrl = new sst.Secret(
  "AxelSaasSupabaseDatabaseUrl",
);
// Supabase service-role key, used by the account-deletion flow to call
// the admin REST API (`auth/v1/admin/users/:id`). MUST be the
// service-role key — the anon key silently no-ops on admin endpoints.
// Defaults empty so the secret can be unset in previews; the deletion
// handler returns a 5xx with a "contact support" message instead of
// crashing in that case.
export const supabaseServiceRoleKey = new sst.Secret(
  "AxelSaasSupabaseServiceRoleKey",
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
