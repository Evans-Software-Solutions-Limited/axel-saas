import { api } from "@/lib/eden";

export type SubscriptionTier = "free" | "premium" | "enterprise";
export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "incomplete";

export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

export interface InvoiceSummary {
  id: string;
  number: string | null;
  status: string | null;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  periodStart: number;
  periodEnd: number;
}

/**
 * Returns the user's subscription state, or null when no row exists yet
 * (e.g., a freshly-confirmed user before /subscriptions/free has fired).
 * Throws on transport errors so the page can show its error state.
 */
export async function fetchSubscriptionStatus(): Promise<SubscriptionInfo | null> {
  const response = await api.core.subscriptions.status.get();
  if (response.error) {
    throw new Error(
      `Failed to fetch subscription status (${response.error.status})`,
    );
  }
  const body = response.data as {
    success: boolean;
    subscription: SubscriptionInfo | null;
  } | null;
  if (!body?.success) {
    throw new Error("Subscription status response was not successful");
  }
  return body.subscription ?? null;
}

/**
 * Returns the latest invoices for the authenticated user. Free-tier users
 * have no Stripe customer — the backend returns 404 in that case and we
 * surface that as an empty list rather than an error so the UI can render
 * the empty state cleanly.
 */
export async function fetchInvoices(limit = 10): Promise<InvoiceSummary[]> {
  const response = await api.core.stripe.invoices.get({
    query: { limit: String(limit) },
  });
  if (response.error) {
    if (response.error.status === 404) return [];
    throw new Error(`Failed to fetch invoices (${response.error.status})`);
  }
  const body = response.data as {
    success: boolean;
    invoices: InvoiceSummary[];
  } | null;
  if (!body?.success) {
    // A 200 with success:false would otherwise silently render as an empty
    // list and hide the failure from the user. Match the sibling functions
    // and surface it.
    throw new Error("Invoices response was not successful");
  }
  return body.invoices ?? [];
}

/**
 * Open the Stripe Customer Portal in the same tab. `flow` lets the caller
 * deep-link into the cancel flow. Throws on error so the page can show a
 * banner; the caller is responsible for navigation on success.
 */
export async function openCustomerPortal(
  flow?: "cancel",
): Promise<{ url: string }> {
  const response = await api.core.stripe["customer-portal"].post(
    flow ? { flow } : {},
  );
  if (response.error) {
    throw new Error(`Failed to open billing portal (${response.error.status})`);
  }
  const body = response.data as { success: boolean; url?: string } | null;
  if (!body?.success || !body.url) {
    throw new Error("Billing portal response was missing a URL");
  }
  return { url: body.url };
}
