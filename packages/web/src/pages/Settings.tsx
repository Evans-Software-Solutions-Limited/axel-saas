import { useEffect, useState } from "react";
import { Button } from "@axel-saas/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@axel-saas/ui/card";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import { Badge } from "@axel-saas/ui/badge";
import {
  fetchInvoices,
  fetchSubscriptionStatus,
  openCustomerPortal,
  type InvoiceSummary,
  type SubscriptionInfo,
} from "./settings/settingsApi";

const STATUS_LABELS: Record<SubscriptionInfo["status"], string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Payment failed",
  cancelled: "Cancelled",
  incomplete: "Incomplete",
};

const TIER_LABELS = {
  free: "Free",
  premium: "Premium",
  enterprise: "Enterprise",
} as const;

function formatRenewalDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatInvoiceDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatInvoiceAmount(minorUnits: number, currency: string): string {
  const value = (minorUnits / 100).toFixed(2);
  const symbol =
    currency.toLowerCase() === "gbp" ? "£" : `${currency.toUpperCase()} `;
  return `${symbol}${value}`;
}

export function Settings() {
  // Profile + notifications stay mocked for this PR — wired up in a
  // follow-up alongside PUT /users/me and the preferences column.
  const [email, setEmail] = useState("user@example.com");
  const [name, setName] = useState("John Doe");
  const [notifications, setNotifications] = useState(true);

  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(
    null,
  );
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);
  // Subscription error fails the whole section — without a tier we can't
  // render the right CTAs. Invoices error is rendered inline within the
  // invoices subsection so a Stripe outage doesn't hide the locally-known
  // tier or the Manage / Cancel buttons.
  const [billingError, setBillingError] = useState<string | null>(null);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  const [portalLoading, setPortalLoading] = useState<
    "manage" | "cancel" | null
  >(null);
  const [portalError, setPortalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Promise.allSettled keeps the two fetches independent. The subscription
    // call hits our DB; the invoices call hits Stripe — they have different
    // failure modes and the page must not couple them.
    void Promise.allSettled([fetchSubscriptionStatus(), fetchInvoices()]).then(
      ([subResult, invResult]) => {
        if (cancelled) return;
        if (subResult.status === "fulfilled") {
          setSubscription(subResult.value);
        } else {
          setBillingError(
            subResult.reason instanceof Error
              ? subResult.reason.message
              : "Could not load your billing information",
          );
        }
        if (invResult.status === "fulfilled") {
          setInvoices(invResult.value);
        } else {
          setInvoicesError(
            invResult.reason instanceof Error
              ? invResult.reason.message
              : "Could not load your invoices",
          );
        }
        setBillingLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenPortal = async (flow?: "cancel") => {
    setPortalError(null);
    setPortalLoading(flow === "cancel" ? "cancel" : "manage");
    try {
      const { url } = await openCustomerPortal(flow);
      window.location.assign(url);
    } catch (err) {
      setPortalError(
        err instanceof Error
          ? err.message
          : "Could not open the billing portal",
      );
      setPortalLoading(null);
    }
  };

  const handleUpgrade = () => {
    // /subscribe shows the plan picker and routes to Stripe checkout via
    // useCheckoutSelection. Free tier has no Stripe customer yet so the
    // customer-portal endpoint isn't applicable.
    window.location.assign("/subscribe");
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-text">Settings</h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Section — UI-only stub, wiring lands in the next PR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text font-display">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-text-secondary text-sm">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text-secondary text-sm">
                Email
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-raised border-border text-text focus:border-accent focus:ring-accent-glow/30"
              />
            </div>
            <Button>Save changes</Button>
          </CardContent>
        </Card>

        {/* Notifications Section — UI-only stub, wiring lands in the next PR */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text font-display">
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text font-medium">Email notifications</p>
                <p className="text-sm text-text-secondary">
                  Get notified of important updates
                </p>
              </div>
              <button
                type="button"
                role="button"
                onClick={() => setNotifications(!notifications)}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 ${
                  notifications ? "bg-accent" : "bg-surface-elevated"
                }`}
              >
                <span className="sr-only">{notifications ? "On" : "Off"}</span>
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${
                    notifications ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-text font-display">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingLoading && (
              <p className="text-sm text-text-secondary">Loading…</p>
            )}

            {!billingLoading && billingError && (
              <p className="text-sm text-destructive">{billingError}</p>
            )}

            {!billingLoading && !billingError && (
              <BillingPanel
                subscription={subscription}
                invoices={invoices}
                invoicesError={invoicesError}
                portalLoading={portalLoading}
                portalError={portalError}
                onUpgrade={handleUpgrade}
                onManage={() => void handleOpenPortal()}
                onCancel={() => void handleOpenPortal("cancel")}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface BillingPanelProps {
  subscription: SubscriptionInfo | null;
  invoices: InvoiceSummary[];
  invoicesError: string | null;
  portalLoading: "manage" | "cancel" | null;
  portalError: string | null;
  onUpgrade: () => void;
  onManage: () => void;
  onCancel: () => void;
}

function BillingPanel({
  subscription,
  invoices,
  invoicesError,
  portalLoading,
  portalError,
  onUpgrade,
  onManage,
  onCancel,
}: Readonly<BillingPanelProps>) {
  const tier = subscription?.tier ?? "free";
  const tierLabel = TIER_LABELS[tier];
  const statusLabel = subscription
    ? STATUS_LABELS[subscription.status]
    : "Active";
  const renewal = formatRenewalDate(subscription?.currentPeriodEnd ?? null);
  // Premium rows can carry status="cancelled" (subscription.deleted webhook
  // marks the row cancelled but never downgrades the tier). Treat those as
  // an "ended" state — different copy, no Cancel button.
  const isCancelled = subscription?.status === "cancelled";
  const isPastDue = subscription?.status === "past_due";
  // Stripe portal cancellations don't delete the subscription immediately
  // — they flip cancel_at_period_end. Status stays "active" until the
  // period ends and `customer.subscription.deleted` fires. While the flag
  // is true, render "Cancellation scheduled · Active until [date]" rather
  // than "Renews [date]" so the user isn't told their cancelled plan is
  // about to renew.
  const isCancellationScheduled =
    subscription?.cancelAtPeriodEnd === true && !isCancelled;

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-text font-medium">{tierLabel}</p>
            <Badge className="bg-accent-muted text-accent border-0">
              {statusLabel}
            </Badge>
          </div>
          {tier === "free" && (
            <p className="text-sm text-text-secondary mt-0.5">£0/month</p>
          )}
          {tier === "premium" && (
            <p className="text-sm text-text-secondary mt-0.5">
              {isCancelled
                ? renewal
                  ? `Premium access ended ${renewal}`
                  : "Premium access ended"
                : isCancellationScheduled
                  ? renewal
                    ? `Cancellation scheduled · Active until ${renewal}`
                    : "Cancellation scheduled"
                  : isPastDue
                    ? "£49/month · Payment failed — please update your payment method"
                    : `£49/month${renewal ? ` · Renews ${renewal}` : ""}`}
            </p>
          )}
          {tier === "enterprise" && (
            <p className="text-sm text-text-secondary mt-0.5">
              Custom plan — contact your account manager
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 items-end">
          {tier === "free" && (
            <Button onClick={onUpgrade} className="text-xs">
              Upgrade to Premium
            </Button>
          )}
          {tier === "premium" && (
            <>
              <Button
                variant="outline"
                onClick={onManage}
                disabled={portalLoading !== null}
                className="text-xs"
              >
                {portalLoading === "manage"
                  ? "Opening…"
                  : isCancelled
                    ? "Manage billing"
                    : "Manage subscription"}
              </Button>
              {/* Hide Cancel for already-cancelled rows — the Stripe portal
                  cancel flow would error against a deleted subscription —
                  and for rows that are already mid-cancellation (the
                  cancel_at_period_end flag is set, just not yet expired).
                  Resuming a scheduled cancellation lives in the Stripe
                  portal, accessed via Manage subscription. */}
              {!isCancelled && !isCancellationScheduled && (
                <Button
                  variant="outline"
                  onClick={onCancel}
                  disabled={portalLoading !== null}
                  className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  {portalLoading === "cancel" ? "Opening…" : "Cancel plan"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {portalError && <p className="text-sm text-destructive">{portalError}</p>}

      {/* Invoices are only meaningful for self-serve Stripe billing.
          Enterprise customers are on custom invoicing handled outside
          Stripe — showing them an "empty Stripe invoices" panel is
          misleading. Free users have no Stripe customer at all. */}
      {tier === "premium" && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-text">Recent invoices</h3>
          {invoicesError ? (
            <p className="text-sm text-destructive">{invoicesError}</p>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-text-secondary">
              No invoices yet — your first one will appear here after your next
              billing cycle.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle border border-border-subtle rounded-xl">
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between p-3 text-sm"
                >
                  <span className="text-text-secondary">
                    {formatInvoiceDate(inv.created)}
                  </span>
                  <span className="text-text font-medium">
                    {formatInvoiceAmount(inv.amountPaid, inv.currency)}
                  </span>
                  <Badge
                    className={
                      inv.status === "paid"
                        ? "bg-accent-muted text-accent border-0"
                        : "bg-destructive/10 text-destructive border-0"
                    }
                  >
                    {inv.status ?? "unknown"}
                  </Badge>
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline text-xs"
                    >
                      View
                    </a>
                  ) : (
                    <span className="text-xs text-text-secondary">—</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
