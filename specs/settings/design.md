# Settings & Billing — Design

## Overview

The Settings page is the user's account management hub. Currently hardcoded with placeholder data. Needs to be wired to real APIs for profile management, billing/subscription control, and notification preferences.

## Sections

### 1. Profile

**Data source:** `GET /users/me` (already exists)  
**Update:** `PUT /users/me` (needs creating or extending)

Fields:
- Name (editable)
- Email (read-only — managed by Supabase auth)
- Avatar (stretch — not MVP)

### 2. Billing & Subscription

**Data sources:**
- `GET /subscriptions/status` — current tier, status, period end
- `GET /stripe/invoices` — invoice history (already exists)

**Actions:**
- Upgrade to Premium (→ Stripe checkout)
- Cancel subscription (→ Stripe customer portal or direct API)
- View invoices

```
┌─────────────────────────────────────────────────┐
│  Billing                                        │
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │ Current plan: Premium       [Active]     │    │
│  │ £49/month · Renews 15 May 2026          │    │
│  │                                         │    │
│  │ [Manage payment →]  [Cancel plan]       │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Free tier?                                     │
│  ┌─────────────────────────────────────────┐    │
│  │ Current plan: Free                      │    │
│  │ Limited daily usage                     │    │
│  │                                         │    │
│  │ [Upgrade to Premium — £49/month →]      │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  Recent Invoices                                │
│  ┌─────────────────────────────────────────┐    │
│  │ 15 Apr 2026  £49.00  Premium   [Paid ✓]│    │
│  │ 15 Mar 2026  £49.00  Premium   [Paid ✓]│    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 3. Notification Preferences

**Needs backend support.** For MVP, keep it simple:
- Email notifications toggle (on/off)
- Stored as a JSON column on the users table or a separate `user_preferences` record

### 4. Danger Zone

- Cancel subscription (if active)
- Delete account (with confirmation — hard deletes user + cascades)

## API Changes

### New/Modified Endpoints

```
PUT /users/me
  Body: { fullName?: string }
  → Updates user profile
  → Returns updated user

GET /subscriptions/status
  → Already exists. Returns: { tier, status, currentPeriodEnd }

POST /subscriptions/cancel
  → Cancels Stripe subscription (sets to cancel at period end)
  → Updates subscription status
  → Returns: { status: "cancelled", activeUntil: "2026-05-15" }

GET /stripe/invoices
  → Already exists. Returns list of invoices.

POST /stripe/customer-portal
  → Creates Stripe customer portal session
  → Returns: { url: "https://billing.stripe.com/..." }
  → User manages payment method here (Stripe-hosted, no PCI burden)

DELETE /users/me
  → Cancels subscription, deletes user (cascades all data)
  → Signs out of Supabase
  → Returns: { status: "deleted" }
```

### Stripe Customer Portal

For managing payment methods and viewing invoices, use Stripe's hosted Customer Portal. This avoids PCI compliance burden — we never touch card details.

```typescript
const session = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${frontendUrl}/dashboard/settings`,
});
return { url: session.url };
```

## Frontend Structure

The Settings page stays as a single page with card sections (current layout). Changes:

1. **Profile card** — wire name to API, make email read-only
2. **Billing card** — show real tier/status/renewal, add invoice list
3. **Notifications card** — wire toggle to backend preference
4. **Danger zone card** — cancel subscription + delete account (with confirms)

All data fetched on mount. Profile update is optimistic with error rollback.
