# Onboarding & Auth — Requirements

## User Stories

### US-A1: Sign up for an account

**As a** new user  
**I want** to create an account with email and password  
**So that** I can start using Axel

**Acceptance Criteria:**

- [ ] `/signup` route is active (no redirect to home)
- [ ] Form fields: full name, email, password
- [ ] Password requirements shown (min length, etc.)
- [ ] "Create account" triggers Supabase sign up
- [ ] After sign up: redirect to dashboard (if auto-confirm) or show verification message
- [ ] Error handling: email already taken, weak password, network error
- [ ] Link to login page for existing users

### US-A2: Sign in to existing account

**As a** returning user  
**I want** to log in with my email and password  
**So that** I can access my dashboard

**Acceptance Criteria:**

- [ ] `/login` route is active (no redirect to home)
- [ ] Form fields: email, password
- [ ] "Sign in" triggers Supabase sign in
- [ ] After sign in: redirect to dashboard (onboarding-aware redirect)
- [ ] Error handling: invalid credentials, network error
- [ ] Link to signup page for new users
- [ ] "Forgot password?" link

### US-A3: Password reset

**As a** user who forgot my password  
**I want** to reset it via email  
**So that** I can regain access

**Acceptance Criteria:**

- [ ] "Forgot password?" link on login page
- [ ] Opens dialog or navigates to reset form
- [ ] User enters email → Supabase sends reset link
- [ ] Confirmation message: "Check your email"
- [ ] Reset link lands on `/reset-password` route
- [ ] User enters new password → updated via Supabase

### US-A4: Onboarding conversation

**As a** new user  
**I want** to have a guided conversation where Axel learns about me  
**So that** my AI assistant is personalised from day one

**Acceptance Criteria:**

- [ ] After first sign-in, user lands on `/dashboard/chat` in onboarding mode
- [ ] Axel asks structured questions (name, what to help with, communication preferences)
- [ ] Responses collected and stored
- [ ] Progress indicator (questions remaining)
- [ ] Onboarding completion generates workspace files
- [ ] User cannot skip required questions

### US-A5: Free tier provisioning after onboarding

**As a** user who completes onboarding and selects Free  
**I want** my agent provisioned immediately  
**So that** I can start using Axel without paying

**Acceptance Criteria:**

- [ ] "Get started" on Free plan triggers provisioning without Stripe
- [ ] Subscription record created with `tier: free, status: active`
- [ ] Container launched with `openclaw-free.json` config
- [ ] User enters live chat mode once agent is active
- [ ] Provisioning polling works same as post-checkout flow

### US-A6: Marketing page CTAs

**As a** visitor  
**I want** clear calls-to-action that lead to sign-up  
**So that** I can get started

**Acceptance Criteria:**

- [ ] Primary CTA on home page leads to `/signup`
- [ ] Pricing page "Get started" leads to `/signup`
- [ ] Waitlist remains as secondary option (for users who want updates but aren't ready)
- [ ] Authenticated users see "Go to dashboard" instead of sign-up CTAs

### US-A7: Smart dashboard redirect

**As a** user  
**I want** to land on the right page based on my state  
**So that** I don't have to navigate manually

**Acceptance Criteria:**

- [ ] Not onboarded → `/dashboard/chat` (onboarding mode)
- [ ] Onboarded, no subscription → `/dashboard/chat` (discovery panel)
- [ ] Onboarded, active subscription → `/dashboard/office`
- [ ] Preserve query params through redirects (e.g. `?checkout=success`)
