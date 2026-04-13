# Onboarding & Auth — Tasks

## Frontend — Auth Pages
- [ ] Re-enable `/signup` route in `App.tsx` (remove redirect logic)
- [ ] Re-enable `/login` route in `App.tsx` (remove redirect logic)
- [ ] Update `SignUp.tsx` — clean form with name, email, password fields
- [ ] Update `Login.tsx` — clean form with email, password fields
- [ ] Add "Forgot password?" link to login page
- [ ] Create `/reset-password` route and page component
- [ ] Implement password reset flow (Supabase `resetPasswordForEmail` + `updateUser`)
- [ ] Style auth pages to match design system (dark theme, accent colours)

## Frontend — Marketing Page CTAs
- [ ] Update Home page CTA: "Join waitlist" → "Get started" (links to `/signup`)
- [ ] Update Pricing page CTAs for Free/Premium tiers (link to `/signup`)
- [ ] Keep waitlist as secondary option where appropriate
- [ ] Show "Go to dashboard" for authenticated users on marketing pages

## Frontend — Onboarding Updates
- [ ] Verify onboarding chat flow works end-to-end with current backend
- [ ] Update discovery panel for 3-tier model (handled in tier-alignment spec — verify integration)
- [ ] Add "Get started" handler for Free tier that calls free provisioning endpoint
- [ ] Ensure provisioning polling works for free tier (same as post-checkout)

## Backend — Free Tier Provisioning
- [ ] Add endpoint or extend existing: provision free agent without Stripe checkout
- [ ] Create subscription record: `{ tier: "free", status: "active" }` without Stripe customer/subscription IDs
- [ ] Trigger container launch with `openclaw-free.json` config
- [ ] Ensure provisioning flow handles free tier (no Stripe customer required)

## Backend — Password Reset
- [ ] Verify Supabase password reset email is configured
- [ ] Add redirect URL to Supabase allowed list: `${FRONTEND_URL}/reset-password`
- [ ] No backend endpoint needed — Supabase handles the flow

## Dashboard Redirect Logic
- [ ] Verify `DashboardIndexRedirect` handles all states:
  - Not onboarded → chat (onboarding)
  - Onboarded, no subscription → chat (discovery)
  - Onboarded, subscribed → office
- [ ] Add subscription status check to redirect logic (may need to fetch from API)
- [ ] Preserve query params through redirects

## Tests
- [ ] Frontend tests for SignUp page (form validation, submission, error states)
- [ ] Frontend tests for Login page (form validation, submission, error states)
- [ ] Frontend tests for password reset flow
- [ ] Frontend tests for dashboard redirect logic (all 3 states)
- [ ] Backend tests for free tier provisioning (subscription creation, container launch)
- [ ] Test onboarding → free provisioning → live chat end-to-end flow

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
