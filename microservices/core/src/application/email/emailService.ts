/**
 * Transactional email service — wraps Resend SDK with fire-and-forget semantics.
 *
 * Failures never throw. Callers (waitlist, Stripe webhooks, usage alerts) must
 * not break if Resend is down or misconfigured. We log the template name and
 * recipient only — never credentials or body content.
 */

import { Resend } from "resend";
import {
  renderTemplate,
  type EmailTemplate,
  type RenderedEmail,
} from "./emailTemplates";

export type { EmailTemplate, RenderedEmail };

export interface SendEmailParams {
  template: EmailTemplate;
  to: string;
  data?: Record<string, string>;
}

const DEFAULT_FROM = "Axel <hello@meetaxel.ai>";

/**
 * Rate-limit bucket for user-scoped templates (usage-warning, daily-limit-reached).
 * Keyed on `${template}:${recipient}`. Exported for testability.
 */
const rateLimitBucket = new Map<string, number>();
const RATE_LIMITED_TEMPLATES: ReadonlySet<EmailTemplate> =
  new Set<EmailTemplate>(["usage-warning", "daily-limit-reached"]);
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function getFromAddress(): string {
  // `||` not `??`: infra binds `EMAIL_FROM_ADDRESS` to
  // `process.env.EMAIL_FROM_ADDRESS || ""` so the Lambda env always has the
  // key. With `??` we'd keep the empty string and Resend would reject every
  // send for an unconfigured deploy. `||` falls back on both unset AND empty.
  return process.env.EMAIL_FROM_ADDRESS || DEFAULT_FROM;
}

let cachedClient: Resend | null = null;

/**
 * Lazily construct the Resend client. Exposed so tests can reset it between
 * runs after stubbing env vars or replacing the SDK mock.
 */
export function resetEmailClient(): void {
  cachedClient = null;
}

function getResendClient(): Resend | null {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

/**
 * Returns true if the caller should be throttled for this (template, recipient)
 * pair. Read-only — does NOT record the send. Recording happens in
 * `recordRateLimitedSend` after a confirmed successful Resend call so a
 * failed send doesn't burn the 24h window.
 */
function shouldRateLimit(template: EmailTemplate, recipient: string): boolean {
  if (!RATE_LIMITED_TEMPLATES.has(template)) return false;
  const key = `${template}:${recipient}`;
  const last = rateLimitBucket.get(key);
  return last !== undefined && Date.now() - last < RATE_LIMIT_WINDOW_MS;
}

function recordRateLimitedSend(
  template: EmailTemplate,
  recipient: string,
): void {
  if (!RATE_LIMITED_TEMPLATES.has(template)) return;
  rateLimitBucket.set(`${template}:${recipient}`, Date.now());
}

/**
 * Clears internal rate-limit state. For tests only.
 */
export function resetEmailRateLimiter(): void {
  rateLimitBucket.clear();
}

/**
 * Fire-and-forget email send. Always resolves; errors are logged, never thrown.
 * Callers may `void sendEmail(...)` to signal non-blocking intent.
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { template, to, data = {} } = params;

  if (!to || typeof to !== "string") {
    console.error("[email] refusing to send: invalid recipient", { template });
    return;
  }

  if (shouldRateLimit(template, to)) {
    console.info("[email] rate-limited", { template, to });
    return;
  }

  let rendered: RenderedEmail;
  try {
    rendered = renderTemplate(template, data);
  } catch (error) {
    console.error("[email] template render failed", {
      template,
      to,
      error: (error as Error).message,
    });
    return;
  }

  const client = getResendClient();
  if (!client) {
    // Useful in local/dev where RESEND_API_KEY is unset — no crash, just log.
    console.info("[email] skipped (no RESEND_API_KEY configured)", {
      template,
      to,
    });
    return;
  }

  try {
    const result = await client.emails.send({
      from: getFromAddress(),
      to,
      subject: rendered.subject,
      html: rendered.html,
    });
    // The Resend SDK resolves with `{ data, error }` on API failures rather
    // than throwing — only network/runtime issues throw. A populated `error`
    // must be treated as a failed send: don't stamp the rate-limit bucket
    // and don't log "[email] sent".
    if (result?.error) {
      console.error("[email] send failed (api error)", {
        template,
        to,
        error: result.error.message ?? String(result.error),
      });
      return;
    }
    recordRateLimitedSend(template, to);
    console.info("[email] sent", { template, to });
  } catch (error) {
    // Fire-and-forget — log only, never throw. The rate-limit bucket is
    // intentionally not recorded so a transient Resend outage doesn't
    // suppress the next 24h of sends for this (template, recipient).
    console.error("[email] send failed", {
      template,
      to,
      error: (error as Error).message,
    });
  }
}
