# CLAUDE.md – Subscriptions Module

## What This Module Owns

Subscription tier definitions, user subscription state, checkout session creation, and tier-based feature gating. Integrates with Stripe for payment processing.

The module exposes:

- **Public routes:** `GET /subscriptions/tiers` (tier list)
- **Protected routes:** `POST /subscriptions/checkout` (create Stripe checkout)

## What Not to Break

### Subscription State Transitions

- User subscription has these states: `pending`, `active`, `cancelled`, `paused`
- Valid transitions:
  - `pending` → `active` (payment confirmed by Stripe webhook)
  - `active` → `cancelled` (user requested cancellation)
  - `active` → `paused` (billing error, temporary hold)
  - `paused` → `active` (billing resolved)
  - Any state → `pending` (renewal/upgrade attempt)
- Invalid transitions must be rejected (e.g., cannot cancel a `pending` subscription)

### Tier Feature Rules

- Starter: Daily brief, Telegram, basic tasks, email triage
- Pro: Starter + calendar, email send/receive, integrations, sub-agents
- Business: Pro + custom channels, multiple agents, priority support
- Developer: Business + full exec access, code generation, API, heavy sub-agent use
- Feature access controlled by current tier; never trust client-side tier claim

### Checkout Idempotency

- Same user + same tier + same timeframe → same Stripe session ID
- Do not create duplicate checkout sessions for the same upgrade
- If Stripe session creation fails, retry with same idempotency key

## Local Conventions

### Repository Pattern

- `SubscriptionRepository` handles all Supabase queries
- No direct DB calls in handlers; always go through repository
- Repository methods are async and typed (return `Subscription` object or error)

### Type Safety

- Tier IDs are string literals: `"starter" | "pro" | "business" | "developer"`
- Subscription state: `"pending" | "active" | "cancelled" | "paused"`
- Never accept tier/state as untyped strings from routes

### Error Handling

- Missing tier ID → 400 (Bad Request)
- Unauthorized → 401 (already handled by middleware)
- Subscription conflict (e.g., can't downgrade during active payment) → 409 (Conflict)
- Stripe API error → 503 (Service Unavailable) with retry-after

## Common Mistakes

1. **Creating Stripe session without idempotency key** → duplicate charges possible
2. **Trusting tier from request body** → use user's current subscription tier from DB
3. **Forgetting to await Stripe API calls** → unhandled promise rejection
4. **Not handling webhook ordering** → subscription state gets out of sync
5. **Cancellation without webhook** → feature access revoked but Stripe still charges
6. **Not testing tier downgrades** → users lose access mid-month

## Test Expectations

- **Unit tests:** Repository methods (mock Supabase), tier definitions, state validation
- **Integration tests:** Elysia route handlers with mock Stripe, full request/response cycle
- **Scenarios covered:**
  - Upgrade from tier A to B (valid)
  - Downgrade from tier A to B (valid)
  - Upgrade when already active (return existing session)
  - Create checkout without auth (401)
  - Create checkout with invalid tier (400)
  - Webhook: payment succeeded → subscription active
  - Webhook: payment failed → subscription pending/cancelled

## Files to Know

| File                        | Purpose                              |
| --------------------------- | ------------------------------------ |
| `subscriptionHandler.ts`    | Route definitions (public/protected) |
| `subscriptionRepository.ts` | (If exists) Supabase queries         |
| `__tests__/`                | Test files (colocated)               |

If `subscriptionRepository.ts` doesn't exist yet, create it when you add Stripe integration (move DB logic out of handler).
