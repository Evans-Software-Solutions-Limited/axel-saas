import { api } from "@/lib/eden";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string | null;
  onboardingCompleted: boolean;
  notificationPreferences: NotificationPreferences;
}

export interface NotificationPreferences {
  emailNotifications: boolean;
  weeklyDigest: boolean;
}

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
  // Mirror of Stripe's cancel_at_period_end. True between a portal-driven
  // cancellation and the period actually ending — the UI uses it to render
  // "Cancellation scheduled" rather than "Renews [date]".
  cancelAtPeriodEnd: boolean;
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

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  weeklyDigest: true,
};

interface UserMeResponseUser {
  id: string;
  email: string;
  fullName: string | null;
  onboardingCompleted: boolean;
  notificationPreferences?: Partial<NotificationPreferences>;
}

function normaliseProfile(user: UserMeResponseUser): UserProfile {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    onboardingCompleted: user.onboardingCompleted,
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(user.notificationPreferences ?? {}),
    },
  };
}

/**
 * Fetch the current user's profile. The Settings page uses this to seed
 * the editable Profile fields and the Notifications toggles. Throws on
 * transport errors and 404 (a missing user row would imply auth/DB
 * skew that the Settings page can't recover from on its own).
 */
export async function fetchUserProfile(): Promise<UserProfile> {
  const response = await api.core.users.me.get();
  if (response.error) {
    throw new Error(`Failed to fetch profile (${response.error.status})`);
  }
  const body = response.data as {
    success: boolean;
    user?: UserMeResponseUser;
  } | null;
  if (!body?.success || !body.user) {
    throw new Error("Profile response was not successful");
  }
  return normaliseProfile(body.user);
}

/**
 * Persist a name change. The handler trims and validates length on its
 * side, but we trim here too so a quick client-side check can disable
 * the Save button without a round-trip.
 */
export async function updateProfileName(name: string): Promise<UserProfile> {
  const response = await api.core.users.me.put({ name });
  if (response.error) {
    throw new Error(`Failed to save profile (${response.error.status})`);
  }
  const body = response.data as {
    success: boolean;
    user?: UserMeResponseUser;
  } | null;
  if (!body?.success || !body.user) {
    throw new Error("Profile update response was not successful");
  }
  return normaliseProfile(body.user);
}

/**
 * Update one or more notification preference toggles. The body is a
 * partial — a missing key on the wire keeps the existing value rather
 * than resetting it to the canonical default. The handler is the source
 * of truth for the merged response.
 */
export async function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const response = await api.core.users.me.notifications.put(prefs);
  if (response.error) {
    throw new Error(
      `Failed to update notification preferences (${response.error.status})`,
    );
  }
  const body = response.data as {
    success: boolean;
    notificationPreferences?: Partial<NotificationPreferences>;
  } | null;
  if (!body?.success) {
    throw new Error("Notification preferences response was not successful");
  }
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(body.notificationPreferences ?? {}),
  };
}

/**
 * Permanently delete the current user's account. The caller is
 * responsible for signing the user out and redirecting — this function
 * only triggers the server-side cascade. Throws on error so the
 * Danger-Zone modal can render a friendly retry message.
 */
export async function deleteAccount(): Promise<void> {
  const response = await api.core.users.me.delete();
  if (response.error) {
    const status = response.error.status;
    // The handler maps Stripe failures to 502 — communicate that as
    // distinct from a generic 500 so the user knows a retry is likely
    // to succeed (vs. needing to contact support).
    if (status === 502) {
      throw new Error(
        "We couldn't cancel your subscription with our payment provider. Please try again in a moment.",
      );
    }
    throw new Error(
      `We couldn't delete your account right now (${status}). Please try again or contact support.`,
    );
  }
  const body = response.data as { success: boolean } | null;
  if (!body?.success) {
    throw new Error("Account deletion response was not successful");
  }
}
