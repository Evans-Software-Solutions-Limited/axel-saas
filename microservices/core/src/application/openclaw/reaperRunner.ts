/**
 * Testable factory + types for the Phase 6 reaper Lambda.
 *
 * The Lambda entrypoint itself lives in `reaperHandler.ts` (excluded
 * from coverage — pure production wiring, same convention as the
 * other `*Handler.ts` files). All business logic that's worth
 * unit-testing lives here, behind `buildHandler(deps)`.
 *
 * Splitting them this way mirrors the codebase's existing convention:
 * `openclawSessionsService.ts` holds the testable logic; the
 * `*Handler.ts` files just wire deps. Keeps the coverage threshold
 * honest without classifying production wiring as untested business
 * code.
 *
 * Spec reference: `docs/openclaw-fargate-spec.md` §6 + §10.
 */

import type { OpenclawSessionsService } from "./openclawSessionsService";

/**
 * Shape of the per-invocation summary returned by the reaper Lambda.
 * Surfaces in CloudWatch logs + the Lambda invocation result; useful
 * for tests asserting on counts without poking the logger.
 */
export interface ReaperRunResult {
  reaped: number;
  failed: number;
  /**
   * Count of expired rows that were already stopped between
   * `listExpired` and `stopSession` (race against a parallel reaper
   * run or a user DELETE). Separate from `reaped` so a sudden
   * pattern shift toward all-notFound is visible — e.g. a future bug
   * where `findById` and `listExpired` use different filter shapes
   * would silently look like a clean reap if these were collapsed.
   * Inspector PR #113 found this distinction matters.
   */
  notFound: number;
  scanned: number;
  durationMs: number;
}

/**
 * Emit three custom metrics so the alarms in `apps/openclaw/infra/
 * reaper.ts` have something to watch:
 *
 *   - `ReapSuccess` — count of sessions stopped this run. Useful as a
 *     "reaper is alive and doing work" signal even when no rows are
 *     expiring (value will be 0).
 *   - `ReapFailure` — count of per-session stopSession errors. The
 *     alarm fires on `>= 1` over any 15-min window: an aggregate
 *     teardown failure shows up immediately rather than waiting for
 *     a tasks-running-> 6h secondary alarm.
 *   - `ReapNotFound` — count of expired rows that disappeared mid-
 *     reap. Distinct from `ReapSuccess` so a pattern shift away from
 *     "all stopped" is visible to the operator without alarming on
 *     it (no alarm by default — `ReapNotFound` should be 0 in steady
 *     state but transient race-positives are normal during a manual
 *     teardown sweep).
 */
export type EmitMetricsFn = (
  result: { reaped: number; failed: number; notFound: number },
  stage: string,
) => Promise<void>;

const defaultLogger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(`[openclaw-reaper] ${msg}`, ctx ?? {}),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(`[openclaw-reaper] ${msg}`, ctx ?? {}),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(`[openclaw-reaper] ${msg}`, ctx ?? {}),
};

/**
 * Build the EventBridge-invoked handler closure. Exposed (rather than
 * just exporting the production handler directly) so unit tests can
 * inject a fake service, a frozen clock, and a stub metric emitter.
 *
 * `emitMetrics` defaults to a no-op so tests don't need to mock the
 * AWS CloudWatch SDK. Production wiring in `reaperHandler.ts` passes
 * in the real emitter.
 */
export function buildHandler(deps: {
  service: OpenclawSessionsService;
  emitMetrics?: EmitMetricsFn;
  stage?: string;
  clock?: () => Date;
  logger?: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  };
}): () => Promise<ReaperRunResult> {
  const emit: EmitMetricsFn = deps.emitMetrics ?? (async () => {});
  const stage = deps.stage ?? process.env.STAGE ?? "unknown";
  const clock = deps.clock ?? (() => new Date());
  const logger = deps.logger ?? defaultLogger;
  return async () => {
    const start = clock().getTime();
    const result = await deps.service.reapExpiredSessions();
    const durationMs = clock().getTime() - start;
    logger.info("reaper: run finished", {
      stage,
      reaped: result.reaped,
      failed: result.failed,
      notFound: result.notFound,
      scanned: result.scanned,
      durationMs,
    });
    await emit(
      {
        reaped: result.reaped,
        failed: result.failed,
        notFound: result.notFound,
      },
      stage,
    );
    return {
      reaped: result.reaped,
      failed: result.failed,
      notFound: result.notFound,
      scanned: result.scanned,
      durationMs,
    };
  };
}
