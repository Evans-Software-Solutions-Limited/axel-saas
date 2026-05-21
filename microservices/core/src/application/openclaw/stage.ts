/**
 * Resolves the SST stage the Lambda is running in.
 *
 * Read order:
 *   1. `OPENCLAW_STAGE` — explicit override, primarily a test seam.
 *   2. `STAGE` — set on the Lambda environment by `infra/api.ts`
 *      (`STAGE: $app.stage`). This is the production source of truth.
 *   3. `SST_STAGE` — older SST-default exposure, kept as a defensive
 *      fallback for any deploy where (2) hasn't landed yet.
 *
 * Throws on cold start if none are set. The handler that reaches for
 * the stage value will surface that as a 503 to the caller rather
 * than letting it crash mid-request.
 */
export function getStage(): string {
  const stage =
    process.env.OPENCLAW_STAGE || process.env.STAGE || process.env.SST_STAGE;
  if (!stage) {
    throw new Error(
      "STAGE is not set on the Lambda environment — wire it via infra/api.ts.",
    );
  }
  return stage;
}
