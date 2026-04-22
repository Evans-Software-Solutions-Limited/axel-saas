/**
 * Tier normalisation for Stripe webhooks. Lives in its own module so tests
 * can import it without pulling `stripeHandler.ts`'s module-level DB clients
 * into scope.
 */

export type NormalisedTier = "free" | "premium" | "enterprise";

/**
 * Map any tier string (including legacy 4-tier values that may still live on
 * old Stripe prices) to one of the current enum values. Returns `null` when
 * the input doesn't map to anything sensible — caller should skip the update
 * rather than write garbage to the DB.
 *
 * Mapping mirrors the 0008_tier_alignment SQL migration:
 *   starter                       → free
 *   pro / business / developer    → premium
 *   free / premium / enterprise   → as-is
 */
export function normaliseTier(raw: unknown): NormalisedTier | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  switch (v) {
    case "free":
    case "premium":
    case "enterprise":
      return v;
    case "starter":
      return "free";
    case "pro":
    case "business":
    case "developer":
      return "premium";
    default:
      return null;
  }
}
