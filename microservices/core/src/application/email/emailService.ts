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
  return process.env.EMAIL_FROM_ADDRESS ?? DEFAULT_FROM;
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
 * pair. Mutates the bucket to record the allowed send.
 */
function shouldRateLimit(template: EmailTemplate, recipient: string): boolean {
  if (!RATE_LIMITED_TEMPLATES.has(template)) return false;
  const key = `${template}:${recipient}`;
  const now = Date.now();
  const last = rateLimitBucket.get(key);
  if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  rateLimitBucket.set(key, now);
  return false;
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
    await client.emails.send({
      from: getFromAddress(),
      to,
      subject: rendered.subject,
      html: rendered.html,
    });
    console.info("[email] sent", { template, to });
  } catch (error) {
    // Fire-and-forget — log only, never throw.
    console.error("[email] send failed", {
      template,
      to,
      error: (error as Error).message,
    });
  }
}
