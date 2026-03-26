/** Anchor id for the join form on the home page. */
export const WAITLIST_SECTION_ID = "waitlist";

/** Shown on marketing surfaces while access is waitlist-first. */
export const RELEASE_EXPECTATION_COPY =
  "Release is expected in the coming weeks.";

/** Link to the waitlist form on home. Optional `tier` maps to API `interestedIn` (Premium → `pro`). */
export function waitlistSignupHref(tier?: "free" | "pro" | "enterprise") {
  if (!tier) return `/#${WAITLIST_SECTION_ID}`;
  return `/?tier=${tier}#${WAITLIST_SECTION_ID}`;
}
