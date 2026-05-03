/**
 * Gateway URL validation, extracted from `chatHandler.ts` so every
 * caller (chat, health check, reload trigger, future usage query)
 * applies the same rules.
 *
 * Rules:
 *   - HTTPS required in production. HTTP allowed only in non-production.
 *   - In production, private/loopback hostnames are rejected — a
 *     compromised provisioning row that points us at `127.0.0.1` would
 *     otherwise leak the user's JWT to whatever's listening on localhost
 *     of the Lambda environment.
 *
 * Returns the canonicalised URL string on success, or `null` if the URL
 * is malformed or fails policy. Callers must treat `null` as a hard
 * failure (don't fall back to a default — that's how SSRF gets through).
 */

const PRIVATE_HOSTNAME_PATTERNS: readonly RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
];

export function validateGatewayUrl(urlString: string): string | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    // URL constructor throws on malformed input. Don't log the bad
    // URL itself — it could carry credentials in a userinfo segment.
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    if (url.protocol !== "https:") {
      console.error("Gateway URL must use HTTPS in production");
      return null;
    }
    if (PRIVATE_HOSTNAME_PATTERNS.some((re) => re.test(url.hostname))) {
      console.error("Gateway URL cannot be a private/loopback address");
      return null;
    }
  }

  return url.toString();
}
