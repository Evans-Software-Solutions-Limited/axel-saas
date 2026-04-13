# Email & Notifications — Agent Instructions

## Context

The waitlist handler has email stubs (logging only). Multiple features need real transactional email. This spec creates a central email service and replaces all stubs.

## Key Files to Create

| File | Purpose |
|---|---|
| `microservices/core/src/application/email/emailService.ts` | Send email via Resend SDK |
| `microservices/core/src/application/email/emailTemplates.ts` | Template rendering (subject + HTML) |

## Key Files to Modify

| File | What to change |
|---|---|
| `microservices/core/src/application/waitlist/waitlistHandler.ts` | Replace console.info with emailService.send() |
| `microservices/core/src/application/waitlist/waitlistEmail.ts` | Rewrite or replace with emailService |
| `microservices/core/src/application/stripe/stripeHandler.ts` | Add email sends on webhook events |
| `infra/secrets.ts` | Add RESEND_API_KEY secret |
| `infra/api.ts` | Bind RESEND_API_KEY env var |

## Rules

1. **Fire-and-forget.** Email failures are logged, never thrown. A Resend outage must not break waitlist signups or Stripe webhooks.
2. **No HTML template engine.** Simple string interpolation for MVP. Don't add handlebars/mjml/react-email — just template literal functions.
3. **Rate limit warning emails.** Max 1 per template per user per 24h. A simple in-memory map or DB check is fine for MVP.
4. **Don't send PII in logs.** Log template name and recipient email, not the email body content.
5. **Unsubscribe links** on any email that isn't strictly transactional (waitlist, usage alerts).
6. **Test with Resend's test mode** before sending real emails. Resend has a test API key that doesn't actually deliver.

## Template Pattern

```typescript
// emailTemplates.ts
export function renderTemplate(
  template: EmailTemplate,
  data: Record<string, string>
): { subject: string; html: string } {
  const base = (body: string) => `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, system-ui, sans-serif; background: #f9fafb; padding: 32px;">
      <div style="max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px;">
        ${body}
      </div>
      <p style="text-align: center; color: #8a8fa6; font-size: 12px; margin-top: 24px;">
        Axel by Evans Software Solutions · <a href="${data.unsubscribeUrl ?? '#'}">Unsubscribe</a>
      </p>
    </body>
    </html>
  `;

  switch (template) {
    case "welcome":
      return {
        subject: "Welcome to Axel",
        html: base(`
          <h1 style="color: #111;">Hey ${data.name},</h1>
          <p>Your Axel account is ready. Start your onboarding conversation and let Axel learn how to help you.</p>
          <a href="${data.dashboardUrl}" style="display: inline-block; background: #0dd3b0; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open Dashboard</a>
        `)
      };
    // ... other templates
  }
}
```

## Testing Notes

- Mock the Resend SDK (`vi.mock("resend")`)
- Verify each template produces a valid subject and non-empty HTML
- Verify fire-and-forget: mock Resend to throw, assert no exception reaches caller
- Verify rate limiting: call send twice quickly, assert second call is skipped
- Coverage threshold: 90%
