import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OpenclawSessionsService,
  stableUidGid,
  type AwsClientFactory,
} from "../openclawSessionsService";
import type { OpenclawSessionsRepository } from "../openclawSessionsRepository";
import type { OpenclawInfra } from "../ssmContract";

// All AWS SDK packages are dynamic-imported by the service, so a vi.mock
// at module level is the simplest way to control what their commands
// resolve to in tests.

const ecsSend = vi.fn();
const elbv2Send = vi.fn();
const efsSend = vi.fn();
const ec2Send = vi.fn();

vi.mock("@aws-sdk/client-ecs", () => ({
  RunTaskCommand: vi.fn().mockImplementation((input) => ({
    __type: "RunTaskCommand",
    input,
  })),
  StopTaskCommand: vi.fn().mockImplementation((input) => ({
    __type: "StopTaskCommand",
    input,
  })),
  DescribeTasksCommand: vi.fn().mockImplementation((input) => ({
    __type: "DescribeTasksCommand",
    input,
  })),
}));

vi.mock("@aws-sdk/client-elastic-load-balancing-v2", () => ({
  CreateTargetGroupCommand: vi.fn().mockImplementation((input) => ({
    __type: "CreateTargetGroupCommand",
    input,
  })),
  DeleteTargetGroupCommand: vi.fn().mockImplementation((input) => ({
    __type: "DeleteTargetGroupCommand",
    input,
  })),
  RegisterTargetsCommand: vi.fn().mockImplementation((input) => ({
    __type: "RegisterTargetsCommand",
    input,
  })),
  DeregisterTargetsCommand: vi.fn().mockImplementation((input) => ({
    __type: "DeregisterTargetsCommand",
    input,
  })),
  CreateRuleCommand: vi
    .fn()
    .mockImplementation((input) => ({ __type: "CreateRuleCommand", input })),
  DeleteRuleCommand: vi
    .fn()
    .mockImplementation((input) => ({ __type: "DeleteRuleCommand", input })),
  DescribeRulesCommand: vi
    .fn()
    .mockImplementation((input) => ({ __type: "DescribeRulesCommand", input })),
  DescribeTargetHealthCommand: vi.fn().mockImplementation((input) => ({
    __type: "DescribeTargetHealthCommand",
    input,
  })),
}));

vi.mock("@aws-sdk/client-efs", () => ({
  CreateAccessPointCommand: vi.fn().mockImplementation((input) => ({
    __type: "CreateAccessPointCommand",
    input,
  })),
}));

vi.mock("@aws-sdk/client-ec2", () => ({
  DescribeNetworkInterfacesCommand: vi.fn().mockImplementation((input) => ({
    __type: "DescribeNetworkInterfacesCommand",
    input,
  })),
  DescribeSecurityGroupsCommand: vi.fn().mockImplementation((input) => ({
    __type: "DescribeSecurityGroupsCommand",
    input,
  })),
}));

const goldenInfra: OpenclawInfra = {
  clusterArn: "arn:cluster",
  taskDefinitionArns: {
    free: "arn:taskdef/free:1",
    premium: "arn:taskdef/premium:1",
    enterprise: "arn:taskdef/enterprise:1",
  },
  subnetIds: ["subnet-1", "subnet-2"],
  taskSecurityGroupId: "sg-tasks",
  efsFileSystemId: "fs-123",
  albListenerArn: "arn:listener",
  albDnsName: "alb.example.com",
  apiCallerRoleArn: "arn:role/api-caller",
  hostedZoneId: "Z123",
  dnsSuffix: "openclaw.staging.meetaxel.ai",
};

function makeAwsClients(): AwsClientFactory {
  return {
    getEcs: async () => ({ send: ecsSend }) as never,
    getElbV2: async () => ({ send: elbv2Send }) as never,
    getEfs: async () => ({ send: efsSend }) as never,
    getEc2: async () => ({ send: ec2Send }) as never,
  };
}

function makeRepo(overrides: Partial<OpenclawSessionsRepository> = {}) {
  const repo = {
    create: vi.fn().mockResolvedValue(undefined),
    findActiveByName: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    listActiveByUserId: vi.fn().mockResolvedValue([]),
    countActiveByUserId: vi.fn().mockResolvedValue(0),
    findLastEfsAccessPointId: vi.fn().mockResolvedValue(null),
    markStopped: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return repo as unknown as OpenclawSessionsRepository & typeof repo;
}

function primeHappyPathAws() {
  ecsSend.mockImplementation(async (cmd) => {
    if (cmd.__type === "RunTaskCommand") {
      return { tasks: [{ taskArn: "arn:task/abc" }] };
    }
    if (cmd.__type === "DescribeTasksCommand") {
      return {
        tasks: [
          {
            taskArn: "arn:task/abc",
            attachments: [
              {
                details: [{ name: "networkInterfaceId", value: "eni-aaa" }],
              },
            ],
          },
        ],
      };
    }
    if (cmd.__type === "StopTaskCommand") return {};
    return {};
  });
  elbv2Send.mockImplementation(async (cmd) => {
    switch (cmd.__type) {
      case "CreateTargetGroupCommand":
        return { TargetGroups: [{ TargetGroupArn: "arn:tg/abc" }] };
      case "DescribeRulesCommand":
        return { Rules: [{ Priority: "default" }] };
      case "CreateRuleCommand":
        return { Rules: [{ RuleArn: "arn:rule/abc" }] };
      case "RegisterTargetsCommand":
        return {};
      case "DescribeTargetHealthCommand":
        return {
          TargetHealthDescriptions: [
            { Target: { Id: "10.0.0.5", Port: 18789 } },
          ],
        };
      case "DeregisterTargetsCommand":
      case "DeleteRuleCommand":
      case "DeleteTargetGroupCommand":
        return {};
      default:
        return {};
    }
  });
  efsSend.mockImplementation(async (cmd) => {
    if (cmd.__type === "CreateAccessPointCommand") {
      return { AccessPointId: "fsap-new" };
    }
    return {};
  });
  ec2Send.mockImplementation(async (cmd) => {
    if (cmd.__type === "DescribeNetworkInterfacesCommand") {
      return { NetworkInterfaces: [{ PrivateIpAddress: "10.0.0.5" }] };
    }
    if (cmd.__type === "DescribeSecurityGroupsCommand") {
      return { SecurityGroups: [{ VpcId: "vpc-default" }] };
    }
    return {};
  });
}

describe("stableUidGid", () => {
  it("is deterministic for the same userId", () => {
    expect(stableUidGid("user-1")).toBe(stableUidGid("user-1"));
  });

  it("falls inside the [1000, 65000] range", () => {
    for (let i = 0; i < 200; i++) {
      const v = stableUidGid(`user-${i}`);
      expect(v).toBeGreaterThanOrEqual(1000);
      expect(v).toBeLessThan(65000 + 1000);
    }
  });

  it("differs for different inputs (almost always)", () => {
    expect(stableUidGid("a")).not.toBe(stableUidGid("z"));
  });
});

describe("OpenclawSessionsService.createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPathAws();
  });

  function build(repoOverrides: Partial<OpenclawSessionsRepository> = {}) {
    return new OpenclawSessionsService({
      repository: makeRepo(repoOverrides),
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
      uuid: () => "sess-fixed-uuid",
      clock: () => new Date("2026-05-20T12:00:00.000Z"),
      gatewayToken: "tk",
    });
  }

  it("rejects invalid names", async () => {
    const result = await build().createSession({
      userId: "u1",
      tier: "premium",
      name: "Bad Name",
    });
    expect(result.kind).toBe("invalid_name");
  });

  it("returns dns_unavailable when stage has no zone", async () => {
    const svc = new OpenclawSessionsService({
      repository: makeRepo(),
      loadInfra: async () => ({
        ...goldenInfra,
        hostedZoneId: null,
        dnsSuffix: null,
      }),
      awsClients: makeAwsClients(),
      uuid: () => "x",
      clock: () => new Date(),
    });
    const r = await svc.createSession({
      userId: "u1",
      tier: "premium",
      name: "demo",
    });
    expect(r.kind).toBe("dns_unavailable");
  });

  it("returns existing session when the same user reconnects to a running name", async () => {
    const repo = makeRepo({
      findActiveByName: vi.fn().mockResolvedValue({
        id: "existing-uuid",
        userId: "u1",
        name: "demo",
        taskArn: "arn:task/exist",
        targetGroupArn: "arn:tg/exist",
        listenerRuleArn: "arn:rule/exist",
        efsAccessPointId: "fsap-1",
        startedAt: new Date("2026-05-20T11:00:00.000Z"),
        stoppedAt: null,
        stoppedReason: null,
      }),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const result = await svc.createSession({
      userId: "u1",
      tier: "premium",
      name: "demo",
    });
    expect(result.kind).toBe("existing");
    if (result.kind === "existing") {
      expect(result.sessionId).toBe("existing-uuid");
      expect(result.url).toBe("https://demo.openclaw.staging.meetaxel.ai");
    }
    // Should NOT have called RunTask.
    expect(ecsSend).not.toHaveBeenCalled();
  });

  it("returns name_conflict when another user owns the running name", async () => {
    const repo = makeRepo({
      findActiveByName: vi.fn().mockResolvedValue({
        id: "other-uuid",
        userId: "OTHER-USER",
        name: "demo",
        taskArn: "arn:task/other",
        targetGroupArn: "arn:tg/other",
        listenerRuleArn: "arn:rule/other",
        efsAccessPointId: "fsap-other",
        startedAt: new Date(),
        stoppedAt: null,
        stoppedReason: null,
      }),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const r = await svc.createSession({
      userId: "u1",
      tier: "premium",
      name: "demo",
    });
    expect(r.kind).toBe("name_conflict");
  });

  it("returns concurrency_cap when at the tier limit", async () => {
    const repo = makeRepo({
      findActiveByName: vi.fn().mockResolvedValue(null),
      countActiveByUserId: vi.fn().mockResolvedValue(2), // premium cap is 2
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const r = await svc.createSession({
      userId: "u1",
      tier: "premium",
      name: "demo",
    });
    expect(r.kind).toBe("concurrency_cap");
    if (r.kind === "concurrency_cap") {
      expect(r.current).toBe(2);
      expect(r.limit).toBe(2);
    }
  });

  it("creates a new session end-to-end on the happy path", async () => {
    const repo = makeRepo();
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
      uuid: () => "sess-new-uuid",
      clock: () => new Date("2026-05-20T12:00:00.000Z"),
      gatewayToken: "tk",
    });
    const r = await svc.createSession({
      userId: "u1",
      tier: "premium",
      name: "demo",
    });
    expect(r.kind).toBe("created");
    if (r.kind === "created") {
      expect(r.name).toBe("demo");
      expect(r.url).toBe("https://demo.openclaw.staging.meetaxel.ai");
      expect(r.taskArn).toBe("arn:task/abc");
      expect(r.expiresAt).toBe("2026-05-20T20:00:00.000Z"); // +8h premium
    }
    // EFS access point created (no prior).
    expect(efsSend).toHaveBeenCalled();
    // ECS, ELB, EC2 all hit.
    expect(ecsSend.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(elbv2Send.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(ec2Send).toHaveBeenCalled();
    // Row inserted.
    expect(repo.create).toHaveBeenCalledOnce();
  });

  it("reuses an existing EFS access point when present", async () => {
    const repo = makeRepo({
      findLastEfsAccessPointId: vi.fn().mockResolvedValue("fsap-existing"),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const r = await svc.createSession({
      userId: "u1",
      tier: "free",
      name: "demo",
    });
    expect(r.kind).toBe("created");
    expect(efsSend).not.toHaveBeenCalled();
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ efsAccessPointId: "fsap-existing" }),
    );
  });

  it("rolls back AWS resources if listener rule creation fails", async () => {
    elbv2Send.mockImplementation(async (cmd) => {
      switch (cmd.__type) {
        case "CreateTargetGroupCommand":
          return { TargetGroups: [{ TargetGroupArn: "arn:tg/abc" }] };
        case "DescribeRulesCommand":
          return { Rules: [] };
        case "CreateRuleCommand":
          throw new Error("boom");
        case "RegisterTargetsCommand":
          return {};
        case "DeleteRuleCommand":
        case "DeleteTargetGroupCommand":
          return {};
        default:
          return {};
      }
    });
    const repo = makeRepo();
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    await expect(
      svc.createSession({ userId: "u1", tier: "premium", name: "demo" }),
    ).rejects.toThrow(/boom/);
    // Rollback should have called StopTask + DeleteTargetGroup.
    const sentTypes = ecsSend.mock.calls.map((c) => c[0].__type);
    expect(sentTypes).toContain("StopTaskCommand");
    const elbTypes = elbv2Send.mock.calls.map((c) => c[0].__type);
    expect(elbTypes).toContain("DeleteTargetGroupCommand");
    // Row was NOT inserted.
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("throws when RunTask returns no task ARN", async () => {
    ecsSend.mockImplementation(async (cmd) => {
      if (cmd.__type === "RunTaskCommand") {
        return { tasks: [], failures: [{ reason: "RESOURCE:CPU" }] };
      }
      return {};
    });
    const svc = new OpenclawSessionsService({
      repository: makeRepo(),
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    await expect(
      svc.createSession({ userId: "u1", tier: "premium", name: "demo" }),
    ).rejects.toThrow(/RunTask returned no task ARN/);
  });

  it("throws if CreateAccessPoint returns no AccessPointId", async () => {
    efsSend.mockImplementation(async () => ({}));
    const svc = new OpenclawSessionsService({
      repository: makeRepo(),
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    await expect(
      svc.createSession({ userId: "u-new", tier: "premium", name: "demo" }),
    ).rejects.toThrow(/no AccessPointId/);
  });

  it("swallows rollback failures and surfaces the original error", async () => {
    // CreateRule throws → rollback runs → both DeleteTargetGroup
    // AND StopTask also throw. We expect the original CreateRule
    // failure to propagate; the rollback warnings should NOT
    // surface as the rejection reason.
    let createRuleCount = 0;
    elbv2Send.mockImplementation(async (cmd) => {
      switch (cmd.__type) {
        case "CreateTargetGroupCommand":
          return { TargetGroups: [{ TargetGroupArn: "arn:tg/abc" }] };
        case "DescribeRulesCommand":
          return { Rules: [] };
        case "CreateRuleCommand":
          createRuleCount += 1;
          throw new Error("create-rule-boom");
        case "RegisterTargetsCommand":
          return {};
        case "DeleteTargetGroupCommand":
          throw new Error("delete-tg-boom");
        case "DeleteRuleCommand":
          throw new Error("delete-rule-boom");
        default:
          return {};
      }
    });
    ecsSend.mockImplementation(async (cmd) => {
      if (cmd.__type === "RunTaskCommand") {
        return { tasks: [{ taskArn: "arn:task/abc" }] };
      }
      if (cmd.__type === "DescribeTasksCommand") {
        return {
          tasks: [
            {
              attachments: [
                {
                  details: [{ name: "networkInterfaceId", value: "eni-aaa" }],
                },
              ],
            },
          ],
        };
      }
      if (cmd.__type === "StopTaskCommand") throw new Error("stop-task-boom");
      return {};
    });
    const svc = new OpenclawSessionsService({
      repository: makeRepo(),
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    await expect(
      svc.createSession({ userId: "u1", tier: "premium", name: "demo" }),
    ).rejects.toThrow(/create-rule-boom/);
    expect(createRuleCount).toBeGreaterThan(0);
  });

  it("treats null tier as free (no concurrency cap)", async () => {
    const repo = makeRepo({
      countActiveByUserId: vi.fn().mockResolvedValue(0),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const r = await svc.createSession({
      userId: "u1",
      tier: null,
      name: "demo",
    });
    expect(r.kind).toBe("created");
  });
});

describe("OpenclawSessionsService.stopSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPathAws();
  });

  function buildWithRow(row: Record<string, unknown> | null) {
    const repo = makeRepo({
      findById: vi.fn().mockResolvedValue(row),
    });
    return {
      repo,
      svc: new OpenclawSessionsService({
        repository: repo,
        loadInfra: async () => goldenInfra,
        awsClients: makeAwsClients(),
      }),
    };
  }

  it("returns not_found when the row doesn't exist", async () => {
    const { svc } = buildWithRow(null);
    const r = await svc.stopSession({
      sessionId: "missing",
      userId: "u1",
      reason: "user",
    });
    expect(r.kind).toBe("not_found");
  });

  it("returns not_found when the row is already stopped", async () => {
    const { svc } = buildWithRow({
      id: "s",
      userId: "u1",
      taskArn: "arn:task",
      targetGroupArn: "arn:tg",
      listenerRuleArn: "arn:rule",
      stoppedAt: new Date(),
    });
    const r = await svc.stopSession({
      sessionId: "s",
      userId: "u1",
      reason: "user",
    });
    expect(r.kind).toBe("not_found");
  });

  it("returns forbidden when the caller does not own the session", async () => {
    const { svc } = buildWithRow({
      id: "s",
      userId: "OTHER",
      taskArn: "arn:task",
      targetGroupArn: "arn:tg",
      listenerRuleArn: "arn:rule",
      stoppedAt: null,
    });
    const r = await svc.stopSession({
      sessionId: "s",
      userId: "u1",
      reason: "user",
    });
    expect(r.kind).toBe("forbidden");
  });

  it("system-caller (userId=null) bypasses ownership", async () => {
    const { svc, repo } = buildWithRow({
      id: "s",
      userId: "OTHER",
      taskArn: "arn:task",
      targetGroupArn: "arn:tg",
      listenerRuleArn: "arn:rule",
      stoppedAt: null,
    });
    const r = await svc.stopSession({
      sessionId: "s",
      userId: null,
      reason: "reaper",
    });
    expect(r.kind).toBe("stopped");
    expect(repo.markStopped).toHaveBeenCalledWith("s", "reaper");
  });

  it("tears down AWS resources on the happy path", async () => {
    const { svc, repo } = buildWithRow({
      id: "s",
      userId: "u1",
      taskArn: "arn:task",
      targetGroupArn: "arn:tg",
      listenerRuleArn: "arn:rule",
      stoppedAt: null,
    });
    const r = await svc.stopSession({
      sessionId: "s",
      userId: "u1",
      reason: "user",
    });
    expect(r.kind).toBe("stopped");
    const elbTypes = elbv2Send.mock.calls.map((c) => c[0].__type);
    expect(elbTypes).toContain("DeleteRuleCommand");
    expect(elbTypes).toContain("DeleteTargetGroupCommand");
    const ecsTypes = ecsSend.mock.calls.map((c) => c[0].__type);
    expect(ecsTypes).toContain("StopTaskCommand");
    expect(repo.markStopped).toHaveBeenCalledWith("s", "user");
  });

  it("continues teardown even if deregister-targets fails", async () => {
    elbv2Send.mockImplementation(async (cmd) => {
      if (cmd.__type === "DescribeTargetHealthCommand") {
        throw new Error("transient");
      }
      return {};
    });
    const { svc } = buildWithRow({
      id: "s",
      userId: "u1",
      taskArn: "arn:task",
      targetGroupArn: "arn:tg",
      listenerRuleArn: "arn:rule",
      stoppedAt: null,
    });
    const r = await svc.stopSession({
      sessionId: "s",
      userId: "u1",
      reason: "user",
    });
    expect(r.kind).toBe("stopped");
  });
});

describe("OpenclawSessionsService.stopAllForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeHappyPathAws();
  });

  it("returns zeros when the user has no active sessions", async () => {
    const repo = makeRepo({
      listActiveByUserId: vi.fn().mockResolvedValue([]),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    expect(await svc.stopAllForUser("u1", "tier_change")).toEqual({
      stopped: 0,
      failed: 0,
    });
    // No infra load needed for the empty path.
    expect(ecsSend).not.toHaveBeenCalled();
  });

  it("stops every active session and marks each row", async () => {
    const sessions = [
      {
        id: "s1",
        userId: "u1",
        taskArn: "arn:task/1",
        targetGroupArn: "arn:tg/1",
        listenerRuleArn: "arn:rule/1",
      },
      {
        id: "s2",
        userId: "u1",
        taskArn: "arn:task/2",
        targetGroupArn: "arn:tg/2",
        listenerRuleArn: "arn:rule/2",
      },
    ];
    const repo = makeRepo({
      listActiveByUserId: vi.fn().mockResolvedValue(sessions),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const summary = await svc.stopAllForUser("u1", "tier_change");
    expect(summary).toEqual({ stopped: 2, failed: 0 });
    expect(repo.markStopped).toHaveBeenCalledTimes(2);
  });

  it("counts failures without aborting on first error", async () => {
    let stopCallCount = 0;
    ecsSend.mockImplementation(async (cmd) => {
      if (cmd.__type === "StopTaskCommand") {
        stopCallCount += 1;
        if (stopCallCount === 1) throw new Error("first stop boom");
      }
      return {};
    });
    const sessions = [
      {
        id: "s1",
        userId: "u1",
        taskArn: "arn:task/1",
        targetGroupArn: "arn:tg/1",
        listenerRuleArn: "arn:rule/1",
      },
      {
        id: "s2",
        userId: "u1",
        taskArn: "arn:task/2",
        targetGroupArn: "arn:tg/2",
        listenerRuleArn: "arn:rule/2",
      },
    ];
    const repo = makeRepo({
      listActiveByUserId: vi.fn().mockResolvedValue(sessions),
    });
    const svc = new OpenclawSessionsService({
      repository: repo,
      loadInfra: async () => goldenInfra,
      awsClients: makeAwsClients(),
    });
    const summary = await svc.stopAllForUser("u1", "tier_change");
    expect(summary).toEqual({ stopped: 1, failed: 1 });
    expect(repo.markStopped).toHaveBeenCalledTimes(1);
  });
});
