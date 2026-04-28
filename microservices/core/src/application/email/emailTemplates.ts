/**
 * Email templates — minimal, text-forward HTML with a shared base layout.
 *
 * No template engine: plain template literals. The shape of each template's
 * `data` is intentionally loose (`Record<string, string>`) so call sites stay
 * terse; required fields are documented alongside each case.
 */

export type EmailTemplate =
  | "waitlist-joined"
  | "waitlist-updated"
  | "welcome"
  | "subscription-confirmed"
  | "subscription-cancelled"
  | "payment-failed"
  | "usage-warning"
  | "daily-limit-reached";

export interface RenderedEmail {
  subject: string;
  html: string;
}

const BRAND_TEAL = "#0dd3b0";
const BRAND_BG = "#08090d";
const BRAND_TEXT = "#e8ecef";
const BRAND_MUTED = "#8a94a3";

// `||` not `??`: infra binds `APP_URL: process.env.APP_URL || ""` etc., so
// the Lambda env always carries the key. With `??` we'd keep the empty
// string and every email link would render as a relative URL.
const APP_URL = process.env.APP_URL || "https://app.meetaxel.ai";
const MARKETING_URL = process.env.MARKETING_URL || "https://meetaxel.ai";

interface LayoutOptions {
  title: string;
  body: string;
  cta?: { label: string; href: string };
  unsubscribeLink?: string;
  preheader?: string;
}

/**
 * Shared dark-background HTML shell. Callers provide their own inner body HTML.
 */
function renderLayout(opts: LayoutOptions): string {
  const ctaHtml = opts.cta
    ? `<p style="margin:32px 0;"><a href="${escapeHtml(opts.cta.href)}" style="background:${BRAND_TEAL};color:${BRAND_BG};padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${escapeHtml(opts.cta.label)}</a></p>`
    : "";

  const footerHtml = opts.unsubscribeLink
    ? `<p style="color:${BRAND_MUTED};font-size:12px;margin-top:48px;">You received this email because of your activity on Axel. <a href="${escapeHtml(opts.unsubscribeLink)}" style="color:${BRAND_MUTED};">Unsubscribe</a>.</p>`
    : `<p style="color:${BRAND_MUTED};font-size:12px;margin-top:48px;">Axel · <a href="${MARKETING_URL}" style="color:${BRAND_MUTED};">meetaxel.ai</a></p>`;

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(opts.preheader)}</div>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Figtree,sans-serif;">
    ${preheader}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};color:${BRAND_TEXT};max-width:560px;">
            <tr>
              <td style="padding:0 0 24px 0;">
                <span style="font-size:20px;font-weight:700;color:${BRAND_TEAL};letter-spacing:-0.02em;">Axel</span>
              </td>
            </tr>
            <tr>
              <td style="color:${BRAND_TEXT};font-size:16px;line-height:1.6;">
                ${opts.body}
                ${ctaHtml}
              </td>
            </tr>
            <tr>
              <td>${footerHtml}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Minimal HTML escaper for interpolated user data.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderTemplate(
  template: EmailTemplate,
  data: Record<string, string> = {},
): RenderedEmail {
  switch (template) {
    case "waitlist-joined": {
      const interestedIn = data.interestedIn ?? "Axel";
      const unsubscribeLink = data.unsubscribeLink ?? "";
      return {
        subject: "You're on the Axel waitlist",
        html: renderLayout({
          title: "You're on the Axel waitlist",
          preheader: "We'll keep you posted as spots open up.",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">You're on the list.</h1>
            <p>Thanks for your interest in <strong>${escapeHtml(interestedIn)}</strong>. We'll be in touch as soon as we're ready to invite you in.</p>
            <p style="color:${BRAND_MUTED};">In the meantime, follow along for updates.</p>
          `,
          cta: { label: "Visit meetaxel.ai", href: MARKETING_URL },
          unsubscribeLink,
        }),
      };
    }

    case "waitlist-updated": {
      const interestedIn = data.interestedIn ?? "Axel";
      const unsubscribeLink = data.unsubscribeLink ?? "";
      return {
        subject: "Your Axel waitlist preference is updated",
        html: renderLayout({
          title: "Waitlist preference updated",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">Preference updated.</h1>
            <p>We've updated your interest to <strong>${escapeHtml(interestedIn)}</strong>. You'll hear from us when it's your turn.</p>
          `,
          unsubscribeLink,
        }),
      };
    }

    case "welcome": {
      const name = data.name ?? "there";
      const dashboardUrl = data.dashboardUrl ?? `${APP_URL}/dashboard`;
      return {
        subject: "Welcome to Axel",
        html: renderLayout({
          title: "Welcome to Axel",
          preheader: "Your account is ready — start your onboarding.",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">Hey ${escapeHtml(name)},</h1>
            <p>Your Axel account is ready. Head to the dashboard to start your onboarding conversation — Axel will get up to speed on how you work.</p>
          `,
          cta: { label: "Open Dashboard", href: dashboardUrl },
        }),
      };
    }

    case "subscription-confirmed": {
      const tier = data.tier ?? "premium";
      const dashboardUrl = data.dashboardUrl ?? `${APP_URL}/dashboard`;
      return {
        subject: "Your Axel subscription is active",
        html: renderLayout({
          title: "Subscription confirmed",
          preheader: `Your ${tier} plan is live.`,
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">You're in.</h1>
            <p>Your <strong>${escapeHtml(tier)}</strong> subscription is active. Axel is spinning up your workspace now.</p>
            <p style="color:${BRAND_MUTED};">You'll receive invoices by email. Manage billing from Settings at any time.</p>
          `,
          cta: { label: "Open Dashboard", href: dashboardUrl },
        }),
      };
    }

    case "subscription-cancelled": {
      const endsAt = data.endsAt ?? "the end of your billing period";
      const resubscribeUrl = data.resubscribeUrl ?? `${APP_URL}/subscribe`;
      return {
        subject: "Your Axel subscription has been cancelled",
        html: renderLayout({
          title: "Subscription cancelled",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">Subscription cancelled.</h1>
            <p>We've cancelled your Axel subscription. You'll keep access until <strong>${escapeHtml(endsAt)}</strong>.</p>
            <p>If this wasn't intentional, you can resubscribe any time.</p>
          `,
          cta: { label: "Resubscribe", href: resubscribeUrl },
        }),
      };
    }

    case "payment-failed": {
      const billingUrl = data.billingUrl ?? `${APP_URL}/settings/billing`;
      return {
        subject: "Action needed: Axel payment failed",
        html: renderLayout({
          title: "Payment failed",
          preheader: "Update your payment method to keep Axel running.",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">Your payment didn't go through.</h1>
            <p>We weren't able to process your most recent payment. Axel will retry automatically, but updating your card now avoids any service interruption.</p>
          `,
          cta: { label: "Update payment method", href: billingUrl },
        }),
      };
    }

    case "usage-warning": {
      // Callers pass `usagePercent` (matches the token-management path).
      const percent = data.usagePercent ?? "80";
      const upgradeUrl = data.upgradeUrl ?? `${APP_URL}/subscribe`;
      return {
        subject: "You're approaching your Axel usage limit",
        html: renderLayout({
          title: "Approaching usage limit",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">You're at ${escapeHtml(percent)}% of your limit.</h1>
            <p>Heads up — you've used ${escapeHtml(percent)}% of your Axel tokens for this period. Once you hit 100%, Axel will pause until the next cycle or an upgrade.</p>
          `,
          cta: { label: "Upgrade plan", href: upgradeUrl },
        }),
      };
    }

    case "daily-limit-reached": {
      const upgradeUrl = data.upgradeUrl ?? `${APP_URL}/subscribe`;
      return {
        subject: "You've hit your daily Axel limit",
        html: renderLayout({
          title: "Daily limit reached",
          body: `
            <h1 style="color:${BRAND_TEXT};font-size:24px;margin:0 0 16px;">Daily limit reached.</h1>
            <p>You've used all of today's free Axel capacity. Your limit resets tomorrow — or upgrade for higher daily caps.</p>
          `,
          cta: { label: "Upgrade plan", href: upgradeUrl },
        }),
      };
    }
    default: {
      // Runtime safety net — TypeScript prevents this at compile time, but
      // an `as EmailTemplate` cast at a call site could otherwise slip past.
      throw new Error(`Unknown email template: ${String(template)}`);
    }
  }
}
