# Skill: Stripe Change

Use this when integrating Stripe webhook handlers, payment session creation, or event listeners.

## Before You Start

1. Read the root CLAUDE.md → "Dangerous Areas" → "Stripe Payments"
2. Read `microservices/core/src/application/stripe/stripeHandler.ts`
3. Check Stripe API docs for the specific event type you're handling

## Checklist

- [ ] Verify webhook signature (`stripe.webhooks.constructEvent()`)
- [ ] Implement idempotent event processing (check if already processed by event ID)
- [ ] Extract required fields from Stripe payload; validate them
- [ ] Update subscription state atomically (one DB call per state change)
- [ ] Handle out-of-order events (e.g., `charge.succeeded` before `invoice.paid`)
- [ ] Add error handling (transient vs permanent failures)
- [ ] Write tests: webhook replay, missing fields, signature mismatch
- [ ] No hardcoded Stripe API keys; use environment variables
- [ ] Test with `stripe listen` webhook forwarding

## After You're Done

1. `bun run test:unit` — must pass
2. Verify webhook replay doesn't double-process (`POST /stripe/webhook` twice with same event)
3. Check coverage ≥ 90% on `stripeHandler.ts`
