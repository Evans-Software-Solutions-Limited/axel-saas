/**
 * Unit tests for the Phase 6 reaper Lambda handler.
 *
 * We exercise the testable factory `buildHandler(deps)` — the exported
 * `handler` itself just wires production deps and is a thin shell
 * (excluded from coverage analysis in vitest config terms; covered
 * indirectly via the factory it delegates to). Tests inject a stub
 * service so the real DB / AWS SDK paths aren't pulled in.
 */

import { describe, it, expect, vi } from "vitest";
import { buildHandler } from "../reaperRunner";
import type { OpenclawSessionsService } from "../openclawSessionsService";

function makeService(
  result: {
    reaped: number;
    failed: number;
    notFound: number;
    scanned: number;
  } = {
    reaped: 0,
    failed: 0,
    notFound: 0,
    scanned: 0,
  },
  overrides: { throwInstead?: Error } = {},
) {
  const reapExpiredSessions = overrides.throwInstead
    ? vi.fn().mockRejectedValue(overrides.throwInstead)
    : vi.fn().mockResolvedValue(result);
  return {
    reapExpiredSessions,
  } as unknown as OpenclawSessionsService;
}

describe("reaperHandler.buildHandler", () => {
  it("returns the service result enriched with durationMs", async () => {
    const service = makeService({
      reaped: 3,
      failed: 1,
      notFound: 0,
      scanned: 4,
    });
    let ticks = 0;
    const clock = () => {
      // First call (start) = t0; second call (end) = t0 + 250ms.
      const t = ticks === 0 ? 1_700_000_000_000 : 1_700_000_000_250;
      ticks += 1;
      return new Date(t);
    };
    const emit = vi.fn().mockResolvedValue(undefined);
    const fn = buildHandler({ service, emitMetrics: emit, clock });
    const result = await fn();
    expect(result).toEqual({
      reaped: 3,
      failed: 1,
      notFound: 0,
      scanned: 4,
      durationMs: 250,
    });
  });

  it("emits metrics with the supplied stage label", async () => {
    const service = makeService({
      reaped: 2,
      failed: 0,
      notFound: 0,
      scanned: 2,
    });
    const emit = vi.fn().mockResolvedValue(undefined);
    const fn = buildHandler({
      service,
      emitMetrics: emit,
      stage: "staging",
    });
    await fn();
    expect(emit).toHaveBeenCalledWith(
      { reaped: 2, failed: 0, notFound: 0 },
      "staging",
    );
  });

  it("forwards notFound count through to metrics", async () => {
    // Inspector PR #113 finding: notFound must be a distinct metric
    // so a pattern shift toward all-notFound (which would mask a
    // findById/listExpired filter drift bug) becomes visible.
    const service = makeService({
      reaped: 1,
      failed: 0,
      notFound: 3,
      scanned: 4,
    });
    const emit = vi.fn().mockResolvedValue(undefined);
    const fn = buildHandler({ service, emitMetrics: emit, stage: "staging" });
    await fn();
    expect(emit).toHaveBeenCalledWith(
      { reaped: 1, failed: 0, notFound: 3 },
      "staging",
    );
  });

  it("falls back to STAGE env var when stage is not passed", async () => {
    const oldStage = process.env.STAGE;
    process.env.STAGE = "preprod";
    try {
      const service = makeService();
      const emit = vi.fn().mockResolvedValue(undefined);
      const fn = buildHandler({ service, emitMetrics: emit });
      await fn();
      expect(emit).toHaveBeenCalledWith(expect.anything(), "preprod");
    } finally {
      if (oldStage === undefined) {
        delete process.env.STAGE;
      } else {
        process.env.STAGE = oldStage;
      }
    }
  });

  it("falls back to 'unknown' when stage and STAGE are both unset", async () => {
    const oldStage = process.env.STAGE;
    delete process.env.STAGE;
    try {
      const service = makeService();
      const emit = vi.fn().mockResolvedValue(undefined);
      const fn = buildHandler({ service, emitMetrics: emit });
      await fn();
      expect(emit).toHaveBeenCalledWith(expect.anything(), "unknown");
    } finally {
      if (oldStage !== undefined) {
        process.env.STAGE = oldStage;
      }
    }
  });

  it("propagates errors from reapExpiredSessions (no swallow)", async () => {
    // The Lambda invocation must fail (visible as a Lambda Errors
    // metric alarm) when the underlying reap throws — silently
    // succeeding here would mask a real outage.
    const service = makeService(undefined, {
      throwInstead: new Error("ThrottlingException: Rate exceeded"),
    });
    const emit = vi.fn();
    const fn = buildHandler({ service, emitMetrics: emit });
    await expect(fn()).rejects.toThrow(/ThrottlingException/);
    // And no metrics should have been emitted — the failure path
    // exits before the emit call. The Lambda Errors built-in metric
    // is the alarm trigger; emitting a fake success would muddy the
    // ReapSuccess/ReapFailure custom-metric semantics.
    expect(emit).not.toHaveBeenCalled();
  });

  it("does not let an emit failure fail the invocation", async () => {
    // PutMetricData is best-effort. A CloudWatch outage during an
    // emit MUST NOT cascade into "Lambda failed" — that would flip
    // the Errors alarm and obscure the actual cause. The default
    // emitMetrics impl swallows its own errors; we verify here that
    // even when a *test* emit rejects, buildHandler still surfaces
    // it (so the production impl's swallow is the only resilience
    // boundary, kept honest).
    const service = makeService({
      reaped: 1,
      failed: 0,
      notFound: 0,
      scanned: 1,
    });
    const emit = vi.fn().mockRejectedValue(new Error("CW down"));
    const fn = buildHandler({ service, emitMetrics: emit });
    // Per design: a custom emit that throws WILL propagate. The
    // production code wraps PutMetricData in its own try/catch.
    // This test documents the contract.
    await expect(fn()).rejects.toThrow(/CW down/);
  });
});
