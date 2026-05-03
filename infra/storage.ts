/**
 * Storage resources backing per-Lambda state that needs to outlive a
 * single invocation.
 *
 * Today: a DynamoDB table backing the per-user rate limiter
 * (`feat/authed-rate-limit-middleware`). Lambda-local in-memory
 * counters were the spec's MVP suggestion, but they fragment across
 * concurrent invocations — a determined client could hit `N × limit`
 * by hammering enough cold instances in parallel. DynamoDB gives us
 * shared state with atomic conditional-update and TTL-based cleanup
 * for stale buckets, with no separate cluster to manage.
 *
 * Schema:
 *   pk      (string, partition key)  "<userId>#<category>#<windowStart>"
 *   count   (number)                 incremented atomically per request
 *   ttl     (number, TTL attribute)  windowEnd + safety margin → DDB auto-deletes
 *
 * Wired into the Lambda env via `infra/api.ts` (RATE_LIMITS_TABLE).
 */

export const rateLimitsTable = new sst.aws.Dynamo("rate-limits", {
  fields: {
    pk: "string",
  },
  primaryIndex: { hashKey: "pk" },
  ttl: "ttl",
});
