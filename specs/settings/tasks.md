# Settings & Billing — Tasks

## Backend — Profile
- [ ] Add `PUT /users/me` endpoint to `userHandler.ts` — update `fullName`
- [ ] Validate input (name length, sanitisation)
- [ ] Return updated user object

## Backend — Subscription Management
- [ ] Add `POST /subscriptions/cancel` endpoint — calls `stripe.subscriptions.update({ cancel_at_period_end: true })`
- [ ] Add `POST /stripe/customer-portal` endpoint — creates Stripe billing portal session, returns URL
- [ ] Ensure `GET /subscriptions/status` returns correct data for new tier model (free/premium/enterprise)

## Backend — Account Deletion
- [ ] Add `DELETE /users/me` endpoint
- [ ] Cancel Stripe subscription if active
- [ ] Delete user from DB (cascade deletes all related data)
- [ ] Delete Supabase auth user via admin API
- [ ] Clean up workspace/provisioning if applicable
- [ ] Return success

## Backend — Notification Preferences
- [ ] Add `notification_preferences` JSONB column to users table (or create `user_preferences` table)
- [ ] Create migration
- [ ] Add `PUT /users/me/preferences` endpoint
- [ ] Add `GET /users/me/preferences` endpoint (or include in `GET /users/me` response)

## Frontend — Settings Page Rewrite
- [ ] Rewrite `packages/web/src/pages/Settings.tsx` — fetch real data on mount
- [ ] Create `packages/web/src/pages/settings/settingsApi.ts` — eden client calls

## Frontend — Profile Section
- [ ] Pre-populate name from `GET /users/me`
- [ ] Make email read-only
- [ ] "Save changes" calls `PUT /users/me`
- [ ] Show success/error feedback
- [ ] Optimistic update with rollback

## Frontend — Billing Section
- [ ] Fetch subscription status from `/subscriptions/status`
- [ ] Show tier name, status badge, renewal date
- [ ] Free tier: show "Upgrade to Premium" CTA → Stripe checkout
- [ ] Premium tier: show "Manage payment" → Stripe customer portal
- [ ] Premium tier: show "Cancel plan" with confirmation dialog
- [ ] Cancelled state: show "Active until [date]" message
- [ ] Fetch and display invoice list from `/stripe/invoices`

## Frontend — Notifications Section
- [ ] Wire toggle to backend preference endpoint
- [ ] Load initial state on mount
- [ ] Optimistic toggle with rollback

## Frontend — Danger Zone
- [ ] Add danger zone card at bottom
- [ ] "Cancel subscription" button (if active subscription)
- [ ] "Delete account" button with double-confirmation (dialog + email verification)
- [ ] Account deletion calls `DELETE /users/me`, then signs out and redirects

## Tests
- [ ] Unit tests for `PUT /users/me` (valid input, invalid input, auth required)
- [ ] Unit tests for subscription cancel (active → cancelled, already cancelled)
- [ ] Unit tests for account deletion (cascade, Stripe cancellation)
- [ ] Unit tests for customer portal session creation
- [ ] Frontend tests for settings page rendering with different tiers
- [ ] Frontend tests for profile save flow
- [ ] Frontend tests for cancel confirmation dialog
- [ ] Frontend tests for delete account double-confirmation

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
