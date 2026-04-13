# Email & Notifications — Tasks

## Infrastructure

- [ ] Choose email provider (Resend recommended) and create account
- [ ] Add domain (meetaxel.ai) to provider and configure DNS: SPF, DKIM, DMARC in Route 53
- [ ] Verify domain deliverability (send test email, check inbox placement)
- [ ] Add `RESEND_API_KEY` as SST secret in `infra/secrets.ts`
- [ ] Add env var binding in `infra/api.ts`

## Email Service

- [ ] Create `microservices/core/src/application/email/emailService.ts` — send function wrapping Resend SDK
- [ ] Create `microservices/core/src/application/email/emailTemplates.ts` — template rendering (subject + HTML per template type)
- [ ] Implement fire-and-forget pattern: log errors, never throw
- [ ] Add internal rate limiting: max 1 email per template per user per day (for warning/limit types)

## Email Templates

- [ ] `waitlist-joined` — confirmation with tier preference and unsubscribe link
- [ ] `waitlist-updated` — tier preference updated confirmation
- [ ] `welcome` — account ready, link to dashboard
- [ ] `subscription-confirmed` — tier, price, renewal date, what's unlocked
- [ ] `subscription-cancelled` — confirmation, access end date, resubscribe CTA
- [ ] `payment-failed` — what happened, update payment link, access deadline
- [ ] `usage-warning` — approaching cap, usage stats, upgrade CTA (free) or awareness (premium)
- [ ] `daily-limit-reached` — cap hit, reset time, upgrade CTA (free)

## Template Styling

- [ ] Create base HTML template (header, body, footer with unsubscribe)
- [ ] Style: minimal, clean, dark or white background, teal (#0dd3b0) CTA buttons
- [ ] Mobile responsive (simple single-column layout)
- [ ] Test rendering in Gmail, Outlook, Apple Mail (basic check)

## Integration — Replace Stubs

- [ ] `waitlistHandler.ts` — replace `console.info` with `emailService.send("waitlist-joined", ...)` and `emailService.send("waitlist-updated", ...)`
- [ ] `waitlistEmail.ts` — either rewrite or replace entirely with emailService calls

## Integration — New Trigger Points

- [ ] `stripeHandler.ts` checkout.session.completed → send `subscription-confirmed`
- [ ] `stripeHandler.ts` invoice.payment_failed → send `payment-failed`
- [ ] `stripeHandler.ts` customer.subscription.deleted → send `subscription-cancelled`
- [ ] Welcome email: send on first successful `/users/me` response (track with flag to avoid re-sending)
- [ ] Usage service (from token-management spec) → send `usage-warning` at 80%, `daily-limit-reached` at 100%

## Tests

- [ ] Unit tests for emailService (mock Resend SDK, verify correct template/recipient/data)
- [ ] Unit tests for template rendering (each template produces valid subject + HTML)
- [ ] Unit tests for fire-and-forget (Resend throws → no exception propagated)
- [ ] Unit tests for internal rate limiting (second send within 24h is skipped)
- [ ] Integration tests: verify waitlist handler calls emailService
- [ ] Integration tests: verify stripe webhook handler calls emailService

## Quality Gates

- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
