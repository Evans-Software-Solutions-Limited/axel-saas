import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DynamoRateLimitClient } from "../rateLimitClient";

// AWS SDK is dynamic-imported so the mock has to match shape exactly.
const sendMock = vi.fn();
const ConditionalCheckFailedException = class extends Error {
  constructor() {
    super("conditional");
    this.name = "ConditionalCheckFailedException";
  }
};

vi.mock("@aws-sdk/client-dynamodb", () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({
    send: sendMock,
  })),
  // The implementation uses `new UpdateItemCommand({...})` then sends —
  // we just need a constructor that round-trips the input so we can
  // assert on what was sent.
  UpdateItemCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

beforeEach(() => {
  sendMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("DynamoRateLimitClient.incrementAndCheck", () => {
  it("returns allowed + count when DDB update succeeds", async () => {
    sendMock.mockResolvedValue({ Attributes: { count: { N: "3" } } });
    const client = new DynamoRateLimitClient("axel-rate-limits-test");

    const result = await client.incrementAndCheck({
      bucketKey: "user-1#chat#1234",
      limit: 10,
      ttlSeconds: 9999,
    });

    expect(result.allowed).toBe(true);
    expect(result.count).toBe(3);
    // Round-trip the recorded UpdateItem input — table name, key, limit,
    // ttl, condition all there.
    const sent = sendMock.mock.calls[0]![0];
    expect(sent.input.TableName).toBe("axel-rate-limits-test");
    expect(sent.input.Key.pk.S).toBe("user-1#chat#1234");
    expect(sent.input.ExpressionAttributeValues[":limit"].N).toBe("10");
    expect(sent.input.ExpressionAttributeValues[":ttl"].N).toBe("9999");
    expect(sent.input.ConditionExpression).toContain("#count < :limit");
  });

  it("returns allowed=false + count=limit on ConditionalCheckFailedException", async () => {
    sendMock.mockRejectedValue(new ConditionalCheckFailedException());
    const client = new DynamoRateLimitClient("axel-rate-limits-test");

    const result = await client.incrementAndCheck({
      bucketKey: "user-1#chat#1234",
      limit: 10,
      ttlSeconds: 9999,
    });

    expect(result).toEqual({ allowed: false, count: 10 });
  });

  it("re-throws unexpected DDB errors so they bubble (don't silently allow)", async () => {
    const boom = new Error("AWS down");
    boom.name = "InternalServerError";
    sendMock.mockRejectedValue(boom);
    const client = new DynamoRateLimitClient("axel-rate-limits-test");

    await expect(
      client.incrementAndCheck({
        bucketKey: "user-1#chat#1234",
        limit: 10,
        ttlSeconds: 9999,
      }),
    ).rejects.toThrow("AWS down");
  });

  it("defaults the count to 1 when DDB returns no Attributes (first write)", async () => {
    sendMock.mockResolvedValue({});
    const client = new DynamoRateLimitClient("t");

    const result = await client.incrementAndCheck({
      bucketKey: "k",
      limit: 5,
      ttlSeconds: 1,
    });

    expect(result).toEqual({ allowed: true, count: 1 });
  });

  it("falls back to RATE_LIMITS_TABLE env when no table name is passed", async () => {
    const original = process.env.RATE_LIMITS_TABLE;
    process.env.RATE_LIMITS_TABLE = "from-env-table";
    try {
      sendMock.mockResolvedValue({ Attributes: { count: { N: "1" } } });
      const client = new DynamoRateLimitClient();
      await client.incrementAndCheck({
        bucketKey: "k",
        limit: 1,
        ttlSeconds: 1,
      });
      expect(sendMock.mock.calls[0]![0].input.TableName).toBe("from-env-table");
    } finally {
      if (original === undefined) {
        delete process.env.RATE_LIMITS_TABLE;
      } else {
        process.env.RATE_LIMITS_TABLE = original;
      }
    }
  });
});
