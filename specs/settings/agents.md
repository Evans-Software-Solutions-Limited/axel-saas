# Settings & Billing — Agent Instructions

## Context

The Settings page is the account management hub. Currently hardcoded with placeholder values. Wire it to real APIs for profile, billing, notifications, and account management.

## Key Files to Modify

| File                                                                      | What to change                                   |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| `packages/web/src/pages/Settings.tsx`                                     | Full rewrite — fetch real data, wire all actions |
| `microservices/core/src/application/users/userHandler.ts`                 | Add `PUT /users/me`, `DELETE /users/me`          |
| `microservices/core/src/application/subscriptions/subscriptionHandler.ts` | Add `POST /subscriptions/cancel`                 |
| `microservices/core/src/application/stripe/stripeHandler.ts`              | Add `POST /stripe/customer-portal`               |

## Key Files to Create

| File                                             | Purpose           |
| ------------------------------------------------ | ----------------- |
| `packages/web/src/pages/settings/settingsApi.ts` | Eden client calls |

## Stripe Customer Portal

For payment method management, use Stripe's hosted portal. This is critical — we never handle card details directly.

```typescript
// In stripeHandler.ts
const session = await stripe.billingPortal.sessions.create({
  customer: subscription.stripeCustomerId,
  return_url: `${process.env.VITE_WEB_URL}/dashboard/settings`,
});
return { url: session.url };
```

## Account Deletion Order

1. Cancel Stripe subscription (if exists)
2. Delete Supabase auth user (admin API)
3. Delete DB user (cascades to all related tables)
4. Return success
5. Frontend signs out and redirects

**Important:** This must be idempotent. If step 2 fails, step 3 should still run (the user asked for deletion). Log failures but don't block.

## Rules

1. **Email is read-only on the frontend.** Supabase manages email. Don't let users change it via our API.
2. **Cancel at period end, not immediately.** `stripe.subscriptions.update({ cancel_at_period_end: true })` — user keeps access until the end of their billing period.
3. **Double-confirm account deletion.** This is irreversible. First dialog + type email to confirm.
4. **Stripe customer portal for payment.** No PCI burden. No card forms.
5. **No hardcoded values in Settings.** Every displayed value must come from an API call.
6. **Optimistic UI for profile save.** Update UI immediately, rollback on error.

## Testing Notes

- Test profile update: valid name, empty name, too-long name
- Test subscription cancel: active subscription, already cancelled, no subscription
- Test account deletion: with subscription, without subscription, with provisioned agent
- Test settings page renders correctly for: Free tier, Premium tier, Cancelled tier
- Mock Stripe API calls in backend tests
- Coverage threshold: 90%
