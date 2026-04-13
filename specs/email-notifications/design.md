# Email & Notifications — Design

## Overview

The waitlist handler has email stubs (`console.info` only). Multiple features need real transactional email before launch: waitlist confirmations, welcome emails, billing notifications, and usage alerts.

## Email Provider

**Recommendation: Resend** (resend.com)

Why:
- Simple API, excellent DX, good free tier (100 emails/day free, 3000/month)
- Works well with custom domains (meetaxel.ai)
- No infrastructure to manage (unlike self-hosted SES)
- TypeScript SDK

Alternative: AWS SES (already in the AWS ecosystem, cheaper at scale, but more setup).

**Decision:** Use Resend for MVP. Migrate to SES later if volume demands it.

## Email Types

### Transactional (Must-have for MVP)

| Email | Trigger | Priority |
|---|---|---|
| **Waitlist confirmation** | User joins waitlist | P0 |
| **Waitlist update** | User updates tier preference | P1 |
| **Welcome** | User signs up and verifies email | P0 |
| **Subscription confirmed** | Stripe checkout completed | P0 |
| **Subscription cancelled** | User cancels subscription | P1 |
| **Payment failed** | Stripe invoice.payment_failed | P0 |
| **Usage warning** | Token usage hits 80% of cap | P1 |
| **Daily limit reached** | Free tier daily cap hit | P1 |

### Not needed for MVP

- Marketing/newsletter (use Resend broadcast or separate tool later)
- Weekly activity digests
- Integration connection confirmations

## Architecture

```
Feature handler (waitlist, stripe webhook, usage service)
  → Calls EmailService.send(template, recipient, data)
    → Resend API sends email
    → Log success/failure (fire-and-forget)
```

### EmailService

```typescript
// microservices/core/src/application/email/emailService.ts

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type EmailTemplate = 
  | "waitlist-joined"
  | "waitlist-updated"
  | "welcome"
  | "subscription-confirmed"
  | "subscription-cancelled"
  | "payment-failed"
  | "usage-warning"
  | "daily-limit-reached";

interface SendEmailParams {
  template: EmailTemplate;
  to: string;
  data: Record<string, string>;
}

export async function sendEmail({ template, to, data }: SendEmailParams): Promise<void> {
  const { subject, html } = renderTemplate(template, data);
  
  try {
    await resend.emails.send({
      from: "Axel <hello@meetaxel.ai>",
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error(`Failed to send ${template} to ${to}:`, error);
    // Fire-and-forget: don't throw, don't block the caller
  }
}
```

### Email Templates

Simple HTML templates. No complex template engine — just string interpolation for MVP.

```typescript
function renderTemplate(template: EmailTemplate, data: Record<string, string>): { subject: string; html: string } {
  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to Axel",
        html: `
          <h1>Hey ${data.name},</h1>
          <p>Your Axel account is ready. Head to the dashboard to start your onboarding conversation.</p>
          <a href="${data.dashboardUrl}">Open Dashboard</a>
        `
      };
    // ... other templates
  }
}
```

### Template Style

Minimal, text-forward design matching the product's aesthetic:
- Dark background (#08090d) or simple white
- Teal accent (#0dd3b0) for CTAs
- Figtree/system font
- No heavy graphics — just clean text + one CTA button
- Unsubscribe link where legally required

## Environment Variables

```
RESEND_API_KEY          — Resend API key (SST secret)
EMAIL_FROM_ADDRESS      — "Axel <hello@meetaxel.ai>" (or env-specific)
EMAIL_FROM_NAME         — "Axel"
```

## Integration Points

| Feature | Where to call emailService.send() |
|---|---|
| Waitlist | `waitlistHandler.ts` — replace `console.info` stubs |
| Welcome | Supabase auth trigger or `userHandler.ts` on first /users/me call |
| Subscription confirmed | `stripeHandler.ts` → checkout.session.completed |
| Subscription cancelled | Settings cancel handler or stripe webhook |
| Payment failed | `stripeHandler.ts` → invoice.payment_failed |
| Usage warning | `usageService.ts` → when checkUsage returns >80% |
| Daily limit | `usageService.ts` → when checkUsage returns not allowed |

## Rate Limiting (Internal)

Don't spam users:
- Usage warning: max 1 per day per user
- Daily limit reached: max 1 per day per user
- Use a simple check: `SELECT ... WHERE template = ? AND to = ? AND created_at > now() - interval '1 day'`
- Or simpler: track `lastEmailSentAt` per template per user in a lightweight table or cache

## DNS Setup

For emails from `@meetaxel.ai`:
- Add Resend DNS records (SPF, DKIM, DMARC) to Route 53
- Verify domain in Resend dashboard
- Test deliverability before launch
