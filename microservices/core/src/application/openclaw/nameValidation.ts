/**
 * Session name validation per `docs/openclaw-fargate-spec.md` §7.1.
 *
 * `name` is the caller-supplied DNS-safe label that becomes
 * `<name>.openclaw.<zone>`. It is NOT the session ID — the session ID
 * is a uuid generated server-side. The rules here mirror DNS subdomain
 * limits plus a hand-maintained blocklist of values that would either
 * collide with platform infrastructure (`api`, `admin`, …) or look
 * like a system-owned subdomain to a casual reader (`axel-*`).
 *
 * The blocklist is a defensive measure, not a security boundary —
 * routing is by host header against a wildcard cert + wildcard ALIAS,
 * not by registry. The wildcard means any name not explicitly claimed
 * by a session would 404 anyway, so blocking these values just stops
 * a user from confusing themselves or shadowing a public-facing
 * subdomain we might add later.
 */

const NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/;

const RESERVED_EXACT = new Set([
  "admin",
  "api",
  "auth",
  "www",
  "app",
  "mail",
  "health",
  "openclaw",
  "openclaws",
  "axel",
  "root",
  "test",
  "staging",
  "production",
  "preprod",
  "dev",
]);

const RESERVED_PREFIX = ["axel-"];

export type NameValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateSessionName(name: unknown): NameValidationResult {
  if (typeof name !== "string") {
    return { valid: false, reason: "Name must be a string" };
  }
  if (name.length < 3 || name.length > 63) {
    return {
      valid: false,
      reason: "Name must be between 3 and 63 characters",
    };
  }
  if (!NAME_PATTERN.test(name)) {
    return {
      valid: false,
      reason:
        "Name must use lowercase letters, digits, and hyphens, with no leading or trailing hyphen",
    };
  }
  if (RESERVED_EXACT.has(name)) {
    return { valid: false, reason: "Name is reserved" };
  }
  for (const prefix of RESERVED_PREFIX) {
    if (name.startsWith(prefix)) {
      return {
        valid: false,
        reason: `Names starting with "${prefix}" are reserved`,
      };
    }
  }
  return { valid: true };
}
