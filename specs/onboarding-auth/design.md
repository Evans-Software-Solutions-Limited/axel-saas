# Onboarding & Auth — Design

## Overview

The authentication and onboarding flow is the first experience for every user. Currently, login/signup routes are disabled (they redirect to home). Supabase auth is fully integrated — the machinery works, but the UI routes need re-enabling.

The goal: a frictionless path from "I found this product" to "I'm talking to my AI assistant".

## Current State

**Working:**
- Supabase auth (sign up, sign in, sign out, JWT)
- Auth context + provider in React
- Protected routes with `ProtectedRoute` wrapper
- Backend `requireAuth` middleware
- Onboarding flow (questions, messages, workspace generation)
- Post-onboarding agent provisioning
- Chat with 7-state machine

**Needs enabling:**
- Login and Signup page routes (currently redirect to `/`)
- The actual auth UI (forms exist in `Login.tsx` and `SignUp.tsx`)

## User Journey

```
Marketing site → Sign Up → Onboarding Chat → [Free: Use Axel] or [Choose Premium → Stripe → Use Axel]
```

### Detailed Flow

1. **User lands on marketing page** (home, pricing, use cases)
2. **Clicks "Get started" or "Sign up"** → navigates to `/signup`
3. **Creates account** (email + password via Supabase)
4. **Email verification** (Supabase sends confirmation email)
5. **Signs in** → redirected to `/dashboard/chat` (onboarding not complete)
6. **Onboarding conversation** — Axel asks questions, learns about the user
7. **Onboarding completes** → workspace files generated
8. **Discovery panel** — user chooses Free or Premium
   - Free: agent provisioned with free config immediately
   - Premium: Stripe checkout → webhook → agent provisioned with premium config
9. **Agent active** → live chat mode
10. **Redirected to Office** (post-onboarding home)

### Free Tier Provisioning (New)

Currently, agent provisioning only happens after a Stripe checkout webhook. For Free tier, we need to trigger provisioning without payment:

```
Onboarding complete + user selects Free
  → Backend creates subscription record (tier: "free", status: "active")
  → Backend triggers container launch (same provisioning webhook, but with free tier config)
  → Agent provisioned with openclaw-free.json
  → User enters live chat
```

## Changes Required

### Frontend

**Re-enable auth routes:**
- `/signup` — Sign up form (email + password)
- `/login` — Login form (email + password)
- Remove the redirect-to-home logic

**Sign Up page:**
- Clean form: name, email, password
- "Create account" button
- Link to login ("Already have an account?")
- Error handling (email taken, weak password)
- After sign-up: show "Check your email for verification" message
- Or if auto-confirm is on: redirect to dashboard

**Login page:**
- Clean form: email, password
- "Sign in" button
- Link to signup ("Don't have an account?")
- "Forgot password?" link (Supabase reset flow)
- Error handling (invalid credentials)
- After login: redirect to dashboard

**Marketing page CTAs:**
- Update "Join waitlist" buttons to "Get started" / "Sign up" where appropriate
- Keep waitlist as a secondary option if you want to gate access

**Post-onboarding discovery panel:**
- Update for new 3-tier model (Free / Premium / Enterprise)
- Free: "Get started" → triggers free provisioning
- Premium: "Get started" → Stripe checkout

### Backend

**Free tier provisioning:**
- After onboarding complete + user selects "Free":
  - Create subscription record: `{ userId, tier: "free", status: "active" }`
  - Trigger container launch with free tier config
  - No Stripe involved

**Alternatively:** Provision the free agent as soon as onboarding completes, before plan selection. This way the user can start chatting immediately and upgrade later. The discovery panel becomes a "hey, want more?" prompt rather than a gate.

### Auth Provider Updates

The `AuthProvider` currently only calls `/users/me` on `SIGNED_IN` event. This is correct. No changes needed to the auth flow itself.

### Supabase Configuration

- Email verification: configured in Supabase dashboard
- Auto-confirm: may be on for development — verify production setting
- Redirect URLs: ensure `${FRONTEND_URL}/dashboard` is allowed

## Password Reset Flow

Supabase handles this natively:
1. User clicks "Forgot password?" on login page
2. Frontend calls `supabase.auth.resetPasswordForEmail(email)`
3. Supabase sends reset email
4. User clicks link → lands on reset page
5. Frontend calls `supabase.auth.updateUser({ password })`

We need a `/reset-password` route to handle the reset link callback.

## Social Auth (Post-MVP)

Supabase supports Google, GitHub, etc. For MVP, email+password is sufficient. Social auth is a natural follow-up.
