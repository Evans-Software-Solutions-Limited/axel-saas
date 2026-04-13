# Onboarding & Auth — Agent Instructions

## Context

The auth infrastructure (Supabase JWT, auth context, protected routes) is fully built. Login/Signup pages exist but are disabled (redirect to `/`). The onboarding flow works end-to-end. Your job is to re-enable auth routes, update marketing CTAs, and add free tier provisioning.

## Key Files to Modify

| File | What to change |
|---|---|
| `packages/web/src/App.tsx` | Re-enable `/login` and `/signup` routes, add `/reset-password` route |
| `packages/web/src/pages/Login.tsx` | Remove redirect logic, ensure form works |
| `packages/web/src/pages/SignUp.tsx` | Remove redirect logic, add name field, ensure form works |
| `packages/web/src/pages/Home.tsx` | Update primary CTA from waitlist to signup |
| `packages/web/src/pages/Pricing.tsx` | Update tier CTAs to link to signup |
| `packages/web/src/pages/Dashboard.tsx` | Verify redirect logic handles all user states |

## Key Files to Create

| File | Purpose |
|---|---|
| `packages/web/src/pages/ResetPassword.tsx` | Password reset form |

## Auth Flow (Already Working)

```
Sign up → Supabase creates user → trigger fires → public.users row created
  → Sign in → JWT issued → AuthProvider fetches /users/me
    → onboardingCompleted: false → redirect to /dashboard/chat (onboarding mode)
```

Don't rebuild this. It works. Just re-enable the UI entry points.

## Free Tier Provisioning (New)

When a user completes onboarding and selects "Free" in the discovery panel:

```typescript
// In ChatContainer.tsx or DiscoveryPanel handler
async function handleFreePlanSelected() {
  // 1. Create free subscription
  await api.core.subscriptions.free.post();
  
  // 2. Enter provisioning mode (same as post-checkout)
  setMode("provisioning");
  startPollingAgentStatus();
}
```

Backend needs a new endpoint:
```
POST /subscriptions/free
  → Creates subscription { tier: "free", status: "active" }
  → Triggers container launch
  → Returns { status: "provisioning" }
```

## Rules

1. **Don't break existing auth flow.** The Supabase integration works. You're re-enabling UI, not rebuilding auth.
2. **Login/Signup must match the design system.** Dark theme, accent colours, clean forms.
3. **Error messages must be user-friendly.** Not "auth/email-already-in-use" but "An account with this email already exists."
4. **Password reset uses Supabase natively.** No custom email service.
5. **Free provisioning must not require Stripe.** The subscription record has no `stripeCustomerId` or `stripeSubscriptionId`.
6. **Dashboard redirect must be state-aware.** Check both `onboardingCompleted` and subscription status.

## Testing Notes

- Test sign up: valid input, duplicate email, weak password
- Test sign in: valid credentials, wrong password, non-existent email
- Test password reset: request → email → reset → sign in with new password
- Test dashboard redirect: all 3 states (not onboarded, onboarded no sub, onboarded with sub)
- Test free provisioning: subscription created, container launched
- Mock Supabase client in frontend tests
- Coverage threshold: 90%
