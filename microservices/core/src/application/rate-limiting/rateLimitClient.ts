/**
 * DynamoDB-backed rate-limit counter.
 *
 * The Lambda role is granted dynamodb:UpdateItem on this table only via
 * the SST link in `infra/api.ts`. The schema is intentionally tiny:
 *
 *   pk     (string, PK)  "<userId>#<category>#<windowStart>"
 *   count  (number)      requests served in this bucket
 *   ttl    (number)      epoch seconds; DDB auto-deletes past this
 *
 * `incrementAndCheck` performs the increment-with-cap atomically using
 * a conditional UpdateItem: ADD count :one IF count < :limit. On
 * `ConditionalCheckFailedException` we know we hit the cap — no second
 * read needed, no race window.
 *
 * The interface is small + injectable so the service can be tested
 * without a real DDB.
 */

export interface RateLimitClient {
  incrementAndCheck(input: {
    bucketKey: string;
    limit: number;
    /**
     * Absolute epoch-seconds timestamp at which the row should expire
     * — **not a duration**. DynamoDB's TTL attribute is defined in
     * epoch seconds (e.g. `1777845200`), so callers must compute
     * `now + duration` themselves. Passing a small number like `90`
     * here resolves to 1970-01-01 + 90s and DynamoDB will sweep the
     * row almost immediately, silently breaking the limiter.
     */
    expiresAt: number;
  }): Promise<{ allowed: boolean; count: number }>;
}

/**
 * Production implementation backed by AWS SDK v3.
 *
 * The table name comes from `RATE_LIMITS_TABLE` (bound in `infra/api.ts`
 * via `link: [rateLimitsTable]`). The constructor accepts an override
 * so tests can spin up a stub even when the env var isn't set.
 */
export class DynamoRateLimitClient implements RateLimitClient {
  private readonly tableName: string;
  private client: import("@aws-sdk/client-dynamodb").DynamoDBClient | null =
    null;

  constructor(tableName?: string) {
    this.tableName =
      tableName ?? process.env.RATE_LIMITS_TABLE ?? "axel-rate-limits";
  }

  private async getClient() {
    if (!this.client) {
      const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
      this.client = new DynamoDBClient({});
    }
    return this.client;
  }

  async incrementAndCheck(input: {
    bucketKey: string;
    limit: number;
    /** See `RateLimitClient.incrementAndCheck` — absolute epoch seconds. */
    expiresAt: number;
  }): Promise<{ allowed: boolean; count: number }> {
    const client = await this.getClient();
    const { UpdateItemCommand } = await import("@aws-sdk/client-dynamodb");

    try {
      const result = await client.send(
        new UpdateItemCommand({
          TableName: this.tableName,
          Key: { pk: { S: input.bucketKey } },
          // ADD count :one creates the attribute as 1 on first write and
          // increments thereafter. Setting ttl on every write keeps it
          // refreshed if a bucket somehow outlives its initial TTL.
          UpdateExpression:
            "ADD #count :one SET #ttl = if_not_exists(#ttl, :ttl)",
          ConditionExpression:
            "attribute_not_exists(#count) OR #count < :limit",
          ExpressionAttributeNames: {
            "#count": "count",
            "#ttl": "ttl",
          },
          ExpressionAttributeValues: {
            ":one": { N: "1" },
            ":limit": { N: String(input.limit) },
            ":ttl": { N: String(input.expiresAt) },
          },
          ReturnValues: "UPDATED_NEW",
        }),
      );
      const count = Number(result.Attributes?.count?.N ?? "1");
      return { allowed: true, count };
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        err.name === "ConditionalCheckFailedException"
      ) {
        // Cap hit — bucket's count is >= limit, so report `count = limit`
        // without doing a second read. The caller doesn't need the exact
        // overshoot count for the 429 response.
        return { allowed: false, count: input.limit };
      }
      throw err;
    }
  }
}
