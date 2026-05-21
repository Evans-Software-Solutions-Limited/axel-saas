import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOpenclawInfra,
  resetOpenclawInfraCache,
  type SsmReader,
} from "../ssmContract";

function makeReader(values: Record<string, string | undefined>): SsmReader {
  return {
    get: vi.fn(async (name: string) => values[name]),
  };
}

const STAGE = "staging";
const PREFIX = `/axel/${STAGE}/openclaw`;

function goldenValues(
  overrides: Partial<Record<string, string | undefined>> = {},
): Record<string, string | undefined> {
  return {
    [`${PREFIX}/cluster-arn`]:
      "arn:aws:ecs:eu-west-2:111:cluster/openclaw-staging",
    [`${PREFIX}/task-definition-arns`]: JSON.stringify({
      free: "arn:aws:ecs:eu-west-2:111:task-definition/openclaw-free:1",
      premium: "arn:aws:ecs:eu-west-2:111:task-definition/openclaw-premium:1",
      enterprise:
        "arn:aws:ecs:eu-west-2:111:task-definition/openclaw-enterprise:1",
    }),
    [`${PREFIX}/subnet-ids`]: "subnet-aaa,subnet-bbb,subnet-ccc",
    [`${PREFIX}/task-security-group-id`]: "sg-1111",
    [`${PREFIX}/efs-file-system-id`]: "fs-22222",
    [`${PREFIX}/alb-listener-arn`]: "arn:aws:elb:listener/123",
    [`${PREFIX}/alb-dns-name`]: "alb-staging.eu-west-2.elb.amazonaws.com",
    [`${PREFIX}/api-caller-role-arn`]:
      "arn:aws:iam::111:role/openclaw-staging-api-caller",
    [`${PREFIX}/hosted-zone-id`]: "Z1234ABCDE",
    ...overrides,
  };
}

describe("getOpenclawInfra", () => {
  beforeEach(() => {
    resetOpenclawInfraCache();
  });

  it("loads and parses the full contract on staging", async () => {
    const reader = makeReader(goldenValues());
    const infra = await getOpenclawInfra(reader, STAGE);

    expect(infra.clusterArn).toBe(
      "arn:aws:ecs:eu-west-2:111:cluster/openclaw-staging",
    );
    expect(infra.taskDefinitionArns).toEqual({
      free: "arn:aws:ecs:eu-west-2:111:task-definition/openclaw-free:1",
      premium: "arn:aws:ecs:eu-west-2:111:task-definition/openclaw-premium:1",
      enterprise:
        "arn:aws:ecs:eu-west-2:111:task-definition/openclaw-enterprise:1",
    });
    expect(infra.subnetIds).toEqual(["subnet-aaa", "subnet-bbb", "subnet-ccc"]);
    expect(infra.taskSecurityGroupId).toBe("sg-1111");
    expect(infra.efsFileSystemId).toBe("fs-22222");
    expect(infra.albListenerArn).toBe("arn:aws:elb:listener/123");
    expect(infra.albDnsName).toBe("alb-staging.eu-west-2.elb.amazonaws.com");
    expect(infra.apiCallerRoleArn).toBe(
      "arn:aws:iam::111:role/openclaw-staging-api-caller",
    );
    expect(infra.hostedZoneId).toBe("Z1234ABCDE");
    expect(infra.dnsSuffix).toBe("openclaw.staging.meetaxel.ai");
  });

  it("returns null hostedZoneId + dnsSuffix on dev stages", async () => {
    const reader = makeReader({
      ...goldenValues({ [`${PREFIX}/hosted-zone-id`]: undefined }),
    });
    const infra = await getOpenclawInfra(reader, STAGE);
    expect(infra.hostedZoneId).toBeNull();
    expect(infra.dnsSuffix).toBeNull();
  });

  it("derives dnsSuffix from stage even when hostedZoneId is present (production)", async () => {
    const reader = makeReader({
      "/axel/production/openclaw/cluster-arn": "arn:cluster:prod",
      "/axel/production/openclaw/task-definition-arns": JSON.stringify({
        free: "a",
        premium: "b",
        enterprise: "c",
      }),
      "/axel/production/openclaw/subnet-ids": "subnet-zzz",
      "/axel/production/openclaw/task-security-group-id": "sg-prod",
      "/axel/production/openclaw/efs-file-system-id": "fs-prod",
      "/axel/production/openclaw/alb-listener-arn": "arn:listener:prod",
      "/axel/production/openclaw/alb-dns-name": "alb.prod",
      "/axel/production/openclaw/api-caller-role-arn": "arn:role:prod",
      "/axel/production/openclaw/hosted-zone-id": "Zprod",
    });
    const infra = await getOpenclawInfra(reader, "production");
    expect(infra.dnsSuffix).toBe("openclaw.meetaxel.ai");
  });

  it("returns null dnsSuffix on unmapped stages even if hostedZoneId is present", async () => {
    const reader = makeReader({
      "/axel/dev-bradley/openclaw/cluster-arn": "arn:cluster:dev",
      "/axel/dev-bradley/openclaw/task-definition-arns": JSON.stringify({
        free: "a",
        premium: "b",
        enterprise: "c",
      }),
      "/axel/dev-bradley/openclaw/subnet-ids": "subnet-x",
      "/axel/dev-bradley/openclaw/task-security-group-id": "sg-x",
      "/axel/dev-bradley/openclaw/efs-file-system-id": "fs-x",
      "/axel/dev-bradley/openclaw/alb-listener-arn": "arn:listener:x",
      "/axel/dev-bradley/openclaw/alb-dns-name": "alb.x",
      "/axel/dev-bradley/openclaw/api-caller-role-arn": "arn:role:x",
      "/axel/dev-bradley/openclaw/hosted-zone-id": "Zhosted",
    });
    const infra = await getOpenclawInfra(reader, "dev-bradley");
    expect(infra.hostedZoneId).toBe("Zhosted");
    expect(infra.dnsSuffix).toBeNull();
  });

  it("throws if a required parameter is missing", async () => {
    const reader = makeReader({
      ...goldenValues({ [`${PREFIX}/cluster-arn`]: undefined }),
    });
    await expect(getOpenclawInfra(reader, STAGE)).rejects.toThrow(
      /cluster-arn/i,
    );
  });

  it("throws if task-definition-arns is not JSON", async () => {
    const reader = makeReader({
      ...goldenValues({ [`${PREFIX}/task-definition-arns`]: "not-json" }),
    });
    await expect(getOpenclawInfra(reader, STAGE)).rejects.toThrow(
      /task-definition-arns is not valid JSON/i,
    );
  });

  it("throws if task-definition-arns is missing a tier", async () => {
    const reader = makeReader({
      ...goldenValues({
        [`${PREFIX}/task-definition-arns`]: JSON.stringify({
          free: "a",
          premium: "b",
        }),
      }),
    });
    await expect(getOpenclawInfra(reader, STAGE)).rejects.toThrow(
      /missing tier "enterprise"/i,
    );
  });

  it("single-flights concurrent calls", async () => {
    const get = vi.fn(async (name: string) => goldenValues()[name]);
    const reader: SsmReader = { get };
    const [a, b] = await Promise.all([
      getOpenclawInfra(reader, STAGE),
      getOpenclawInfra(reader, STAGE),
    ]);
    expect(a).toBe(b); // same cached promise resolution
    // 9 unique parameter names — fetched once each despite two callers.
    expect(get).toHaveBeenCalledTimes(9);
  });

  it("does not poison the cache on failure — next call retries", async () => {
    const failingReader: SsmReader = {
      get: vi.fn().mockRejectedValueOnce(new Error("transient")),
    };
    await expect(getOpenclawInfra(failingReader, STAGE)).rejects.toThrow(
      "transient",
    );
    // After the first call's promise rejected, the cache should be
    // dropped so the next caller gets a fresh attempt.
    const goodReader = makeReader(goldenValues());
    const infra = await getOpenclawInfra(goodReader, STAGE);
    expect(infra.clusterArn).toBeDefined();
  });
});
