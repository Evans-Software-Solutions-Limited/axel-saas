# Signup + Payments API Spec

**Status:** Drafted from current codebase and product direction  
**Scope:** Public website signup, subscription checkout, webhook activation, and post-payment handoff into Axel  
**Last updated:** 2026-03-19

---

## Why this doc exists

Bradley is building the public website so users can start signing up.

This doc defines the backend/API contract for that flow so we do not end up with:
- a nice marketing site glued to vague backend behaviour
- frontend copy that promises states the API cannot represent
- Stripe/webhook edge cases handled ad hoc in components
- sign-up, onboarding, and provisioning logic drifting apart

This spec is intentionally grounded in the **current repo** rather than wishful future architecture.

---

## Product flow in one sentence

A new user should be able to:
1. create an account,
2. enter discovery chat,
3. choose a plan,
4. pay via Stripe,
5. have their subscription activated by webhook,
6. complete onboarding,
7. be provisioned into their dedicated Axel,
8. continue in the same chat surface.

---

## Source of truth in the current repo

### Existing backend routes

Already implemented in `microservices/core`:

- `POST /stripe/create-checkout-session`
- `POST /stripe/webhook`
- `GET /stripe/invoices`
- `GET /stripe/invoices/:id`
- `GET /users/onboarding/state`
- `POST /users/onboarding/start`
- `POST /users/onboarding/message`
- `POST /users/onboarding/complete`
- `GET /users/me/agent`
- `POST /users/chat/message`
- `POST /provisioning/register` (internal)

### Existing platform state already modelled in DB

From `packages/db/src/schema.ts`:

- `users`
- `subscriptions`
- `provisioning_state`
- onboarding state / transcript tables (via onboarding handler/repository)

Enums already in use:

- subscription tier: `starter | pro | business | developer`
- subscription status: `active | trialing | past_due | cancelled | incomplete`
- provisioning status: `pending | provisioning | active | failed | deprovisioned`

---

## Architecture stance

This is the correct separation for launch:

### 1. Sign up/authentication
Handled by **Supabase Auth**.

The public website should use Supabase directly for:
- sign up
- sign in
- sign out
- session refresh
- email verification / password reset

We do **not** need a custom backend signup endpoint unless we later add:
- invite codes
- anti-abuse screening
- CRM capture before auth
- custom lead qualification before account creation

### 2. Subscription + billing
Handled by our **core API + Stripe**.

The backend is responsible for:
- validating requested tier
- resolving Stripe price IDs from env
- creating/reusing Stripe customer records
- creating checkout sessions
- processing Stripe webhooks
- updating subscription state in DB
- triggering provisioning
- exposing invoices to authenticated users

### 3. Onboarding + agent activation
Handled by our **core API**.

The backend is responsible for:
- tracking onboarding state
- storing onboarding answers/transcript
- generating workspace files
- updating provisioning state
- exposing agent readiness to the frontend

---

## What “signup” means in this product

There are actually **three separate milestones** that must not be conflated:

### A. Account created
The user has a Supabase auth account.

### B. Subscription active
Stripe webhook has marked the subscription active/trialing.

### C. Axel ready
The user has completed onboarding, workspace files exist, and a dedicated agent is either:
- provisioning, or
- active and reachable.

The API must keep these distinct. The frontend should never reduce this to a single boolean like `isSignedUp`.

---

## Canonical state machine

### Auth state
- `anonymous`
- `authenticated`

### Subscription state
- `none`
- `incomplete`
- `trialing`
- `active`
- `past_due`
- `cancelled`

### Onboarding state
- `not_started`
- `in_progress`
- `completed`

### Agent/provisioning state
- `not_found`
- `pending`
- `provisioning`
- `active`
- `failed`
- `subscription_required`

### Important rule
A user can be:
- authenticated but unsubscribed
- subscribed but not onboarded
- onboarded but still provisioning
- provisioned but temporarily unreachable

That is normal. The API should represent it explicitly.

---

## Required user journeys

## 1) Public website → sign up

### Goal
User creates an account from the marketing site and lands in the app in an authenticated state.

### Current implementation
Frontend uses Supabase auth directly.

### Requirements
- Email + password signup supported
- Clear handling for email-confirmation-on vs auto-confirm mode
- Duplicate email attempt returns user-friendly error
- Password reset flow exists before public launch
- Post-signup redirect is deterministic

### Recommended redirect behaviour
- If auth succeeds and user has no completed onboarding: `/dashboard/chat`
- Do **not** send new users to a dead dashboard shell
- Chat remains the product entry point

### Non-goals for launch
- Social auth
- waitlist mode
- referral codes
- invite-only accounts

---

## 2) Discovery chat before payment

### Goal
The user can talk to Axel before choosing a plan, and the UI can recommend a plan based on what they need.

### Current repo shape
The frontend already supports a discovery/subscription-required mode via `GET /users/me/agent` returning `subscription_required`.

### Requirement
The public website/app must treat discovery as a real state, not an error state.

### API contract used today
`GET /users/me/agent`

Possible successful statuses:
- `subscription_required`
- `provisioning`
- `active`
- `failed`
- `not_found`

### Requirement for frontend copy
If status is `subscription_required`, show:
- plan recommendation / CTA
- explanation of why the user needs a plan
- no scary error banner

---

## 3) Start checkout

### Endpoint
`POST /stripe/create-checkout-session`

### Purpose
Create a Stripe Checkout session for the selected tier.

### Auth
Required: Bearer token from Supabase session.

### Request body
```json
{
  "tier": "starter"
}
```

### Allowed values
- `starter`
- `pro`
- `business`
- `developer`

### Current response
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### Current errors
- `401 Unauthorized` — missing/invalid auth
- `400 Invalid tier`
- `404 User not found`
- `500 Price not configured for tier`
- `500 Checkout session URL unavailable`

### Backend requirements
- Must only accept known tiers
- Must resolve price IDs from environment, never from client input
- Must create Stripe customer if one does not exist
- Must reuse existing Stripe customer if one does exist
- Must attach metadata:
  - `userId`
  - `tier`
  - ideally also `supabaseUserId` for debugging parity
- Success URL should preserve app handoff semantics
- Cancel URL should return user to pricing/subscribe cleanly

### Recommended additions
These are not blockers, but they should be added if we want a cleaner long-term contract:

#### Add an explicit response envelope
Instead of only:
```json
{ "url": "..." }
```
prefer:
```json
{
  "success": true,
  "url": "..."
}
```

#### Add idempotency on the Stripe side
To reduce duplicate sessions from double-clicks/network retries.

#### Add analytics-safe metadata
Useful fields:
- `planSource` (`pricing-page`, `chat-recommendation`, `upgrade-modal`)
- `billingInterval` (`monthly`, `annual`) once annual plans exist

---

## 4) Stripe webhook activation

### Endpoint
`POST /stripe/webhook`

### Purpose
Stripe is the source of truth for payment success/failure. This endpoint updates our DB and triggers provisioning.

### Events currently handled
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`

### Requirements

#### Signature verification is mandatory
Already implemented via `STRIPE_WEBHOOK_SECRET`.

#### Webhooks must be idempotent
Replays must not create duplicate provisioning rows or corrupt state.

#### Checkout completion must do all of the following
On `checkout.session.completed`:
- validate required metadata exists
- upsert subscription by Stripe customer ID
- set tier
- set Stripe subscription ID
- set subscription status to `active`
- create `provisioning_state` row if missing
- trigger provisioning launch best-effort

### Important current behaviour
Provisioning trigger failure is logged, but webhook still returns success so Stripe does not retry forever.

That is correct for now, but it means we need strong internal visibility around provisioning failures.

### Gaps / requirements still worth adding
- event deduplication table keyed by Stripe event ID
- explicit audit logging around webhook handling
- alerting when checkout succeeds but provisioning launch fails
- support for annual billing once pricing page adds it
- support for trials if Starter trial goes live

---

## 5) Onboarding completion

### Endpoint
`POST /users/onboarding/complete`

### Purpose
Finalize onboarding, generate workspace files, mark onboarding complete, and move the user into provisioning/live mode.

### Auth
Required.

### Current behaviour
The endpoint:
- loads onboarding answers
- validates required questions are complete
- derives tier from current subscription or falls back to `starter`
- generates workspace files
- creates provisioning state if missing
- writes workspace files to disk
- sets `users.onboardingCompleted = true`
- marks provisioning as provisioned/active at the workspace level
- stores raw onboarding answers
- marks onboarding state completed

### Hard requirements
- Workspace file write must succeed **before** user is marked complete
- Endpoint must remain idempotent for safe retries / re-provisioning
- Must not leak internal workspace paths to clients
- Must fail cleanly if onboarding answers are incomplete

### Important product requirement
This endpoint is the seam between:
- shared/discovery Axel
and
- the user’s dedicated Axel

That seam must stay explicit in docs and code.

---

## 6) Agent readiness after payment/onboarding

### Endpoint
`GET /users/me/agent`

### Purpose
Tell the frontend what chat mode to show.

### This endpoint is critical
It is the state machine endpoint for the whole post-signup experience.

### Current meanings

#### `subscription_required`
User is authenticated and onboarded, but does not have an active/trialing subscription.

#### `provisioning`
The user has enough state to continue, but their dedicated Axel is still being prepared.

#### `active`
Dedicated Axel is ready. May include `handoffGreeting`.

#### `failed`
Provisioning failed and the frontend should show a recovery state.

#### `not_found`
No provisioning record exists yet.

### Requirements
- Frontend polling after Stripe return must use this endpoint
- This endpoint must stay cheap and safe to poll
- It must never leak internal infra details
- It should remain the single source of truth for chat mode

### Recommended improvement
Add machine-readable recovery guidance in failure cases, e.g.
```json
{
  "success": true,
  "status": "failed",
  "reason": "provisioning_webhook_failed",
  "retryable": true
}
```

Right now `failed` is too opaque for a polished public product.

---

## 7) Live paid chat

### Endpoint
`POST /users/chat/message`

### Purpose
Send a message to the dedicated Axel once the user is onboarded and subscribed.

### Requirements
- Requires completed onboarding
- Requires active/trialing subscription
- Requires active provisioned agent
- Must not forward auth to untrusted gateway URLs
- Must validate gateway URL before forwarding auth header

### Current good safeguard
`validateGatewayUrl()` blocks unsafe hosts in production.

Keep that. It is not optional.

---

## 8) Billing history for the account area

### Endpoints
- `GET /stripe/invoices`
- `GET /stripe/invoices/:id`

### Purpose
Support account/billing pages without the frontend talking to Stripe directly.

### Requirements
- Authenticated only
- Must verify invoices belong to the requesting user
- Support pagination on list endpoint
- Surface hosted invoice URL + PDF URL where available

### Notes
This is already a decent foundation for the account area and should be reused by the public site/app account section rather than rebuilt elsewhere.

---

## API requirements by surface

## Marketing site
Needs:
- Supabase signup/signin
- pricing/tier display
- CTA into checkout
- legal pages

Does **not** need:
- direct Stripe SDK business logic beyond redirect support
- direct provisioning knowledge
- direct workspace knowledge

## App shell / dashboard
Needs:
- onboarding state endpoints
- checkout creation endpoint
- agent status endpoint
- live chat endpoint
- invoice endpoints

---

## Data requirements

## Users
Must support:
- auth identity mapping from Supabase
- email
- optional full name
- onboardingCompleted flag
- stored onboarding answers for regeneration

## Subscriptions
Must store:
- internal user ID
- Stripe customer ID
- Stripe subscription ID
- tier
- status
- current period end

## Provisioning state
Must store:
- internal user ID
- provisioning status
- workspace path/internal reference
- gateway URL when ready
- last error message or failure reason

### Recommended schema improvement
If not already present in practice, add structured failure fields:
- `failureCode`
- `failureMessage`
- `lastProvisioningAttemptAt`

Without that, support/debugging will be painful once real users arrive.

---

## Security requirements

### Auth
- Supabase JWT verified server-side on protected endpoints
- No trusting raw client user IDs

### Stripe
- Webhook signature validation required
- Price IDs resolved server-side only
- Tier values validated against allowlist

### Gateway handoff
- Validate gateway URLs before forwarding auth headers
- No private/localhost targets in production

### Secrets/config
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` required
- price IDs required per enabled tier
- frontend URLs must be environment-specific and explicit

---

## Error handling requirements

Public launch quality means the frontend should be able to distinguish:
- auth failure
- no plan selected
- payment cancelled
- payment pending/webhook lag
- onboarding incomplete
- provisioning in progress
- provisioning failed
- chat temporarily unavailable

### Recommendation
Standardise response envelopes for new/updated endpoints:
```json
{
  "success": false,
  "error": {
    "code": "subscription_required",
    "message": "Subscription required to use chat"
  }
}
```

The current mixed shape works technically, but it will create unnecessary frontend branching as the public site grows.

---

## Observability requirements

Before public launch, we need enough logging/metrics to answer:
- how many users signed up today?
- how many reached checkout?
- how many completed payment?
- how many got stuck waiting for webhook?
- how many completed onboarding?
- how many provisioning attempts failed?
- how long from payment success to first active chat?

### Minimum instrumentation events
- `auth.signup.completed`
- `checkout.session.created`
- `checkout.redirected`
- `stripe.webhook.received`
- `stripe.checkout.completed`
- `subscription.activated`
- `onboarding.completed`
- `provisioning.triggered`
- `provisioning.active`
- `provisioning.failed`
- `chat.first_paid_message`

---

## Open questions to resolve before implementation is “done”

### 1. Do we support annual plans at launch?
Current checkout route assumes one price per tier. Annual billing will require interval selection in both UI and API metadata.

### 2. Do we launch with a free Starter trial?
Project docs mention a possible 7-day free trial, but the current checkout path does not explicitly model trial rules.

### 3. Do we need a public “create lead” endpoint before auth?
Maybe not. If marketing wants email capture before signup, keep it separate from auth/signup.

### 4. What is the canonical recovery path for failed provisioning?
Needed for support and self-serve retries.

### 5. Do we want a dedicated `/billing/portal` endpoint?
Probably yes, if users need self-serve plan management without building everything ourselves immediately.

---

## Recommended implementation slices

## Slice 1 — Lock the contract
- Keep Supabase as the signup/auth provider
- Treat this doc as source of truth for public signup + payments flow
- Standardise naming across website/app copy

## Slice 2 — Fill payment gaps
- add webhook event dedupe
- add better provisioning failure visibility
- add structured error codes
- decide trial/annual support

## Slice 3 — Add account billing ergonomics
- Stripe billing portal endpoint
- surfaced invoice history UI
- plan change/cancel semantics

## Slice 4 — Harden provisioning handoff
- richer `GET /users/me/agent` failure payloads
- retry/recover path
- instrumentation for payment → active-chat conversion

---

## Definition of done

This area is only “done” for launch when:

- a user can sign up from the public website
- auth state is persisted correctly
- the user can enter discovery chat
- the user can choose a plan and reach Stripe checkout
- Stripe webhook reliably activates the subscription
- onboarding can complete and generate workspace files
- agent status cleanly transitions through payment/provisioning/live states
- failed states are recoverable and explainable
- invoices are available in-account
- logs/metrics exist for the whole funnel

---

## Summary

The important decision here is simple:

- **Supabase owns signup/auth**
- **our API owns billing, onboarding, provisioning, and live-agent state**

That split is already mostly reflected in the repo.
The job now is to formalise it, harden the edges, and stop the public website from inventing its own backend contract.
