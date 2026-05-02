-- Track Stripe's `cancel_at_period_end` flag on subscriptions.
--
-- When a user cancels via the Stripe Customer Portal, Stripe doesn't flip
-- the subscription status to "cancelled" — it sends a
-- customer.subscription.updated event with status="active" and
-- cancel_at_period_end=true, then a customer.subscription.deleted event
-- when the period actually ends. Without this column the UI can't tell
-- "renewing on date X" apart from "ending on date X" and ends up showing
-- "Renews [date]" immediately after a cancellation, which is misleading.

ALTER TABLE "subscriptions"
  ADD COLUMN "cancel_at_period_end" boolean NOT NULL DEFAULT false;
