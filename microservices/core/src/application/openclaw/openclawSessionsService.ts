/**
 * OpenClaw sessions service — orchestrates the AWS resources behind
 * `POST /openclaw/sessions` and `DELETE /openclaw/sessions/:id`.
 *
 * Spec reference: `docs/openclaw-fargate-spec.md` §7.
 *
 * ## Known limitation: EFS access-point isolation (Phase 6 follow-up)
 *
 * Spec §7.1 step 7 says the per-user EFS access-point ID is passed
 * to RunTask "via task override". The AWS ECS RunTask API does NOT
 * support per-task EFS volume overrides — `overrides.containerOverrides`
 * only covers env, command, cpu, memory, resource requirements, and
 * `overrides.volumeConfigurations` is EBS-only.
 *
 * For Phase 5 we still create + persist a per-user EFS access point
 * (the AWS resource is real, the row references its ID) but the task
 * itself mounts the shared file system at its root path. Per-user
 * logical separation lives in the container entrypoint via
 * `AXEL_USER_ID`. True POSIX-UID isolation requires either upstream
 * ECS support for volume overrides (not on the roadmap as far as I
 * can tell) or per-session `RegisterTaskDefinition` calls — the
 * latter is the Phase 6 work and would only need to swap a couple
 * of helper calls here, leaving the row schema and IAM untouched.
 */

import { randomUUID } from "node:crypto";
import type {
  ECSClient,
  RunTaskCommandOutput,
  Task as EcsTask,
} from "@aws-sdk/client-ecs";
import type { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import type { EFSClient } from "@aws-sdk/client-efs";
import type { EC2Client } from "@aws-sdk/client-ec2";

import type { SubscriptionTier } from "../integrations/tierGate";
import { validateSessionName } from "./nameValidation";
import { getTierPolicy, mapTierForOpenclaw, resolveTier } from "./tierPolicy";
import {
  OpenclawInfraNotDeployedError,
  type OpenclawInfra,
} from "./ssmContract";
import {
  OpenclawSessionsRepository,
  type OpenclawStoppedReason,
} from "./openclawSessionsRepository";

export type CreateSessionResult =
  | {
      kind: "created" | "existing";
      sessionId: string;
      name: string;
      url: string;
      taskArn: string;
      expiresAt: string;
    }
  | { kind: "invalid_name"; reason: string }
  | { kind: "name_conflict" }
  | { kind: "concurrency_cap"; current: number; limit: number }
  | { kind: "dns_unavailable" };

export type StopSessionResult =
  | { kind: "stopped" }
  | { kind: "not_found" }
  | { kind: "forbidden" };

export interface AwsClientFactory {
  getEcs(): Promise<ECSClient>;
  getElbV2(): Promise<ElasticLoadBalancingV2Client>;
  getEfs(): Promise<EFSClient>;
  getEc2(): Promise<EC2Client>;
}

export interface OpenclawSessionsServiceDeps {
  repository: OpenclawSessionsRepository;
  loadInfra: () => Promise<OpenclawInfra>;
  awsClients: AwsClientFactory;
  /** Optional logger — defaults to a no-op shim. */
  logger?: {
    info: (msg: string, ctx?: Record<string, unknown>) => void;
    warn: (msg: string, ctx?: Record<string, unknown>) => void;
    error: (msg: string, ctx?: Record<string, unknown>) => void;
  };
  /** Override for tests — defaults to `crypto.randomUUID`. */
  uuid?: () => string;
  /** Override for tests — defaults to `Date.now`. */
  clock?: () => Date;
  /** Optional gateway-token to inject into every task. */
  gatewayToken?: string | null;
}

/**
 * Detect the ELB v2 "priority slot already taken" error across the
 * shapes the SDK can surface it as. AWS' modular v3 client mostly
 * tags errors with `name`, but mocks (and some older SDK middlewares)
 * use `Code`, and a literal Error from a fetch failure carries it in
 * the message. Belt + braces.
 */
export function isPriorityCollision(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; message?: string };
  if (e.name === "PriorityInUseException") return true;
  if (e.Code === "PriorityInUse") return true;
  if (typeof e.message === "string" && /priority.*in.?use/i.test(e.message)) {
    return true;
  }
  return false;
}

/** Stable UID/GID per spec §7.1 — same user always gets the same POSIX ID. */
export function stableUidGid(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  // Map into [1000, 65000] to avoid system UIDs and ensure 16-bit safety
  // for older POSIX consumers.
  return 1000 + (hash % 64000);
}

export class OpenclawSessionsService {
  private repository: OpenclawSessionsRepository;
  private loadInfra: () => Promise<OpenclawInfra>;
  private awsClients: AwsClientFactory;
  private logger: NonNullable<OpenclawSessionsServiceDeps["logger"]>;
  private uuid: () => string;
  private clock: () => Date;
  private gatewayToken: string | null;

  constructor(deps: OpenclawSessionsServiceDeps) {
    this.repository = deps.repository;
    this.loadInfra = deps.loadInfra;
    this.awsClients = deps.awsClients;
    this.logger = deps.logger ?? {
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.uuid = deps.uuid ?? randomUUID;
    this.clock = deps.clock ?? (() => new Date());
    this.gatewayToken = deps.gatewayToken ?? null;
  }

  async createSession(input: {
    userId: string;
    tier: SubscriptionTier | null;
    name: string;
  }): Promise<CreateSessionResult> {
    const validation = validateSessionName(input.name);
    if (!validation.valid) {
      return { kind: "invalid_name", reason: validation.reason };
    }
    const lowerName = input.name.toLowerCase();
    const tier = resolveTier(input.tier);
    const policy = getTierPolicy(tier);

    // Two shapes of "openclaw isn't available on this stage" need to
    // collapse into the same `dns_unavailable` result, so the handler
    // returns a clean 503 instead of a 500:
    //
    //   1. SSM contract is FULLY present but `hosted-zone-id` is null
    //      (dev / preview stages — the openclaw SST app explicitly
    //      skips writing the zone id when no Route53 zone exists).
    //   2. SSM contract is MISSING ENTIRELY — the openclaw SST app
    //      hasn't been deployed to this stage at all. The loader
    //      throws "Missing SSM parameter ..." in that case.
    //
    // Pre-fix, only (1) returned dns_unavailable; (2) bubbled the
    // loader's throw up to the handler's catch-all and 500'd, which
    // looked like an outage instead of a "feature disabled" signal
    // and noised up CloudWatch alarms. Now both paths return the
    // same kind and the handler maps cleanly to 503.
    let infra: OpenclawInfra;
    try {
      infra = await this.loadInfra();
    } catch (err) {
      // ONLY swallow the specific "stack not deployed" signal —
      // every other failure shape (throttling, AccessDenied, parse
      // failures, transient network blips) must propagate so the
      // user's retry behaviour is preserved instead of getting a
      // fake 503 that hides a real transient AWS issue.
      if (err instanceof OpenclawInfraNotDeployedError) {
        this.logger.warn(
          "openclaw infra not deployed; treating as dns_unavailable",
          { error: err.message },
        );
        return { kind: "dns_unavailable" };
      }
      throw err;
    }
    if (!infra.hostedZoneId || !infra.dnsSuffix) {
      return { kind: "dns_unavailable" };
    }

    // Idempotency + cross-user collision check up front so we avoid
    // wasting an EFS access-point or RunTask on a request that would
    // 409 anyway.
    const existing = await this.repository.findActiveByName(lowerName);
    if (existing) {
      if (existing.userId !== input.userId) {
        return { kind: "name_conflict" };
      }
      // Same user reconnecting to their own running session — return
      // the existing one untouched (spec §7.1 idempotency clause).
      // expiresAt MUST be computed against the row's pinned tier
      // (the tier the session started under), not the caller's
      // current tier. Otherwise a downgrade after start would shrink
      // wallClockMs and return a past timestamp for a still-running
      // session, which would make any client comparing against `now`
      // render the session as expired.
      const existingPolicy = getTierPolicy(existing.tier);
      return {
        kind: "existing",
        sessionId: existing.id,
        name: existing.name,
        url: this.sessionUrl(existing.name, infra),
        taskArn: existing.taskArn,
        expiresAt: this.computeExpiresAt(
          existing.startedAt,
          existingPolicy.wallClockMs,
        ),
      };
    }

    const activeCount = await this.repository.countActiveByUserId(input.userId);
    if (activeCount >= policy.maxConcurrentSessions) {
      return {
        kind: "concurrency_cap",
        current: activeCount,
        limit: policy.maxConcurrentSessions,
      };
    }
    // Note on TOCTOU: countActiveByUserId + repository.create are not
    // atomic, so two concurrent POSTs from the same user with
    // DIFFERENT names — both started when the user is at `limit - 1`
    // — can both pass this check and both insert successfully. The
    // partial unique index on `lower(name) WHERE stopped_at IS NULL`
    // only blocks the same-name race, not the same-user-different-name
    // one. We add a compensating recheck after insert (below) so the
    // over-cap row gets torn down — bounded blast radius is one extra
    // task running for the duration of the slower request's AWS
    // lifecycle, which is preferable to a full per-user advisory
    // lock held across the 22s ENI poll.

    const sessionId = this.uuid();
    const efsAccessPointId = await this.resolveEfsAccessPoint({
      userId: input.userId,
      infra,
    });

    let runOutput: RunTaskCommandOutput;
    try {
      runOutput = await this.runTask({
        userId: input.userId,
        sessionId,
        name: lowerName,
        tier,
        taskDefinitionArn: infra.taskDefinitionArns[policy.taskDefinitionKey],
        infra,
      });
    } catch (err) {
      this.logger.error("RunTask failed", {
        userId: input.userId,
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }

    const task = runOutput.tasks?.[0];
    const taskArn = task?.taskArn;
    if (!taskArn) {
      throw new Error(
        `RunTask returned no task ARN (failures=${JSON.stringify(
          runOutput.failures,
        )})`,
      );
    }

    let targetGroupArn: string | undefined;
    let listenerRuleArn: string | undefined;
    let startedAt: Date | undefined;
    // Explicit signal for the outer catch — true iff repository.create
    // resolved. Without this, a failure in rankAmongActive (or
    // markStopped) on the loser branch would leave the row at
    // stopped_at IS NULL pointing at AWS resources safeRollback just
    // deleted, holding the name reserved and serving a `kind:
    // "existing"` URL that never resolves on the user's retry.
    let rowInserted = false;

    try {
      const taskIp = await this.waitForTaskIp({
        clusterArn: infra.clusterArn,
        taskArn,
      });
      targetGroupArn = await this.createTargetGroup({
        sessionId,
        infra,
      });
      await this.registerTargets({
        targetGroupArn,
        taskIp,
      });
      listenerRuleArn = await this.createListenerRule({
        sessionId,
        host: `${lowerName}.${infra.dnsSuffix}`,
        targetGroupArn,
        listenerArn: infra.albListenerArn,
      });
      // Insert is INSIDE the try block so a unique-constraint
      // violation on `lower(name) WHERE stopped_at IS NULL` (the
      // partial index added in migration 0013) triggers the same
      // rollback path as any other AWS-step failure. Without this,
      // concurrent same-name retries from one user would both pass
      // the up-front `findActiveByName` check, both run the full
      // AWS lifecycle, and the second insert would 23505 — leaving
      // its ECS task + target group + listener rule orphaned with
      // no row to track them.
      //
      // The explicit `id: sessionId` is critical: without it, the
      // DB generates its own UUID via `defaultRandom()` and the
      // value the API returns to the caller would have no row,
      // making every subsequent `DELETE /openclaw/sessions/:id`
      // 404 in the handler.
      startedAt = this.clock();
      await this.repository.create({
        id: sessionId,
        userId: input.userId,
        name: lowerName,
        tier,
        taskArn,
        targetGroupArn,
        listenerRuleArn,
        efsAccessPointId,
      });
      rowInserted = true;

      // Compensating check for the concurrency-cap TOCTOU documented
      // above. If a concurrent POST also passed at `limit - 1` and
      // inserted in parallel, we'd both be over-cap. A naive
      // "post-insert count > limit → rollback" check fails here
      // because BOTH racers see the same committed state and both
      // conclude they're the loser — the user ends up with zero
      // sessions instead of one. Instead we ask the repository for
      // OUR row's rank among the user's active rows sorted by
      // (started_at, id). Rank < limit → keep; rank ≥ limit → we're
      // the loser, roll back. The (started_at, id) total order is
      // stable across both racers' views, so exactly one of them
      // rolls back.
      const rank = await this.repository.rankAmongActive(
        input.userId,
        sessionId,
      );
      if (rank < 0 || rank >= policy.maxConcurrentSessions) {
        this.logger.warn(
          "Concurrency cap exceeded via TOCTOU race — rolling back this request",
          {
            userId: input.userId,
            sessionId,
            rank,
            limit: policy.maxConcurrentSessions,
          },
        );
        await this.safeRollback({
          clusterArn: infra.clusterArn,
          taskArn,
          targetGroupArn,
          listenerRuleArn,
        });
        await this.repository.markStopped(sessionId, "error");
        return {
          kind: "concurrency_cap",
          // Report the cap itself — the user's actual current is
          // whatever the winners landed on, which we don't have a
          // clean read of from here without a second roundtrip.
          // Reporting `limit` is honest: "you're already at cap."
          current: policy.maxConcurrentSessions,
          limit: policy.maxConcurrentSessions,
        };
      }
    } catch (err) {
      this.logger.error("Session post-RunTask wiring failed; rolling back", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Best-effort rollback so we don't leak ECS / ELB resources.
      await this.safeRollback({
        clusterArn: infra.clusterArn,
        taskArn,
        targetGroupArn,
        listenerRuleArn,
      });
      // If repository.create succeeded before this catch fired (i.e.
      // rankAmongActive or markStopped threw), the row is now pointing
      // at AWS resources safeRollback just deleted. Mark it stopped
      // so the partial unique index releases the name and a future
      // POST doesn't return `kind: "existing"` with a dead URL.
      // markStopped's own failure is swallowed — we don't want to
      // shadow the original error, and the dangling row can still be
      // cleaned up by a `DELETE /openclaw/sessions/:id` (which now
      // tolerates not_found per the round 2 swallowNotFound fix) or
      // the Phase 6 reaper.
      if (rowInserted) {
        await this.repository
          .markStopped(sessionId, "error")
          .catch((markErr) => {
            this.logger.warn("rollback: markStopped failed", {
              sessionId,
              error:
                markErr instanceof Error ? markErr.message : String(markErr),
            });
          });
      }
      throw err;
    }

    return {
      kind: "created",
      sessionId,
      name: lowerName,
      url: this.sessionUrl(lowerName, infra),
      taskArn,
      expiresAt: this.computeExpiresAt(startedAt, policy.wallClockMs),
    };
  }

  private async resolveEfsAccessPoint(args: {
    userId: string;
    infra: OpenclawInfra;
  }): Promise<string> {
    const existing = await this.repository.findLastEfsAccessPointId(
      args.userId,
    );
    if (existing) return existing;

    const uid = stableUidGid(args.userId);
    const efs = await this.awsClients.getEfs();
    const { CreateAccessPointCommand } = await import("@aws-sdk/client-efs");
    const out = await efs.send(
      new CreateAccessPointCommand({
        FileSystemId: args.infra.efsFileSystemId,
        ClientToken: `openclaw-${args.userId}`,
        PosixUser: { Uid: uid, Gid: uid },
        RootDirectory: {
          Path: `/users/${args.userId}`,
          CreationInfo: {
            OwnerUid: uid,
            OwnerGid: uid,
            Permissions: "0750",
          },
        },
        Tags: [
          { Key: "App", Value: "openclaw" },
          { Key: "UserId", Value: args.userId },
        ],
      }),
    );
    if (!out.AccessPointId) {
      throw new Error(
        `CreateAccessPoint returned no AccessPointId for user ${args.userId}`,
      );
    }
    return out.AccessPointId;
  }

  private async runTask(args: {
    userId: string;
    sessionId: string;
    name: string;
    tier: SubscriptionTier;
    taskDefinitionArn: string;
    infra: OpenclawInfra;
  }): Promise<RunTaskCommandOutput> {
    const ecs = await this.awsClients.getEcs();
    const { RunTaskCommand } = await import("@aws-sdk/client-ecs");
    const environment: { name: string; value: string }[] = [
      { name: "AXEL_USER_ID", value: args.userId },
      { name: "AXEL_SESSION_ID", value: args.sessionId },
      { name: "AXEL_SESSION_NAME", value: args.name },
      { name: "AXEL_TIER", value: mapTierForOpenclaw(args.tier) },
    ];
    if (this.gatewayToken) {
      environment.push({
        name: "OPENCLAW_GATEWAY_TOKEN",
        value: this.gatewayToken,
      });
    }

    return ecs.send(
      new RunTaskCommand({
        cluster: args.infra.clusterArn,
        taskDefinition: args.taskDefinitionArn,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: args.infra.subnetIds,
            securityGroups: [args.infra.taskSecurityGroupId],
            assignPublicIp: "ENABLED",
          },
        },
        overrides: {
          containerOverrides: [{ name: "openclaw", environment }],
        },
        tags: [
          { key: "App", value: "openclaw" },
          { key: "UserId", value: args.userId },
          { key: "SessionId", value: args.sessionId },
          { key: "Tier", value: args.tier },
        ],
        propagateTags: "TASK_DEFINITION",
      }),
    );
  }

  private async waitForTaskIp(args: {
    clusterArn: string;
    taskArn: string;
  }): Promise<string> {
    const ecs = await this.awsClients.getEcs();
    const { DescribeTasksCommand } = await import("@aws-sdk/client-ecs");
    // API Gateway HTTP API caps the integration timeout at 30s (with
    // service-quota bumps available up to 60s). The Lambda timeout in
    // `infra/api.ts` is set to 60s so this method has headroom to
    // complete in-process even when the client has already received
    // a 504 — that way the row + AWS resources stay consistent and
    // the user's retry resolves the same row via idempotency.
    //
    // Poll budget here is tightened to ~22s so that on warm image
    // pulls (the 90%+ case) we return well inside API Gateway's 30s
    // wire. Cold-pull Fargate launches (30–90s per spec §11) will
    // exceed this and surface as a 504 to the user; the row is left
    // in the DB and a retry within the wall-clock cap returns the
    // running session via the spec §7.1 idempotency clause. A fully
    // async start-then-poll refactor is tracked as a Phase 6
    // follow-up — out of scope here.
    const ENI_WAIT_MS = 22_000;
    const POLL_INTERVAL_MS = 1_500;
    const deadline = Date.now() + ENI_WAIT_MS;
    let eni: string | undefined;
    while (Date.now() < deadline) {
      const out = await ecs.send(
        new DescribeTasksCommand({
          cluster: args.clusterArn,
          tasks: [args.taskArn],
        }),
      );
      const task: EcsTask | undefined = out.tasks?.[0];
      eni = task?.attachments?.[0]?.details?.find(
        (d) => d.name === "networkInterfaceId",
      )?.value;
      if (eni) break;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    if (!eni) {
      throw new Error(
        `Task ENI did not attach within ${ENI_WAIT_MS / 1000}s for task ${args.taskArn} ` +
          `(likely a cold image pull; user can retry — the idempotency clause will return the same session if it does come up)`,
      );
    }
    const ec2 = await this.awsClients.getEc2();
    const { DescribeNetworkInterfacesCommand } =
      await import("@aws-sdk/client-ec2");
    const eniOut = await ec2.send(
      new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [eni] }),
    );
    const privateIp = eniOut.NetworkInterfaces?.[0]?.PrivateIpAddress;
    if (!privateIp) {
      throw new Error(`No PrivateIpAddress on ENI ${eni}`);
    }
    return privateIp;
  }

  private async createTargetGroup(args: {
    sessionId: string;
    infra: OpenclawInfra;
  }): Promise<string> {
    const elbv2 = await this.awsClients.getElbV2();
    const { CreateTargetGroupCommand } =
      await import("@aws-sdk/client-elastic-load-balancing-v2");
    // Target group names are capped at 32 chars; we shorten the
    // session UUID to keep within the limit.
    const tgName = `oc-${args.sessionId.replace(/-/g, "").slice(0, 28)}`;
    const out = await elbv2.send(
      new CreateTargetGroupCommand({
        Name: tgName,
        Protocol: "HTTP",
        Port: 18789,
        VpcId: await this.resolveDefaultVpcId(args.infra),
        TargetType: "ip",
        HealthCheckProtocol: "HTTP",
        HealthCheckPath: "/",
        // OpenClaw's gateway returns 200 on `/` (Control-UI SPA) once
        // the runtime is fully up. Generous threshold gives the
        // container time to install the bridge plugin + load the
        // workspace on first boot.
        HealthCheckIntervalSeconds: 15,
        HealthyThresholdCount: 2,
        UnhealthyThresholdCount: 3,
      }),
    );
    const tg = out.TargetGroups?.[0]?.TargetGroupArn;
    if (!tg) throw new Error("CreateTargetGroup returned no ARN");
    return tg;
  }

  private async registerTargets(args: {
    targetGroupArn: string;
    taskIp: string;
  }): Promise<void> {
    const elbv2 = await this.awsClients.getElbV2();
    const { RegisterTargetsCommand } =
      await import("@aws-sdk/client-elastic-load-balancing-v2");
    await elbv2.send(
      new RegisterTargetsCommand({
        TargetGroupArn: args.targetGroupArn,
        Targets: [{ Id: args.taskIp, Port: 18789 }],
      }),
    );
  }

  private async createListenerRule(args: {
    sessionId: string;
    host: string;
    targetGroupArn: string;
    listenerArn: string;
  }): Promise<string> {
    const elbv2 = await this.awsClients.getElbV2();
    const { CreateRuleCommand, DescribeRulesCommand } =
      await import("@aws-sdk/client-elastic-load-balancing-v2");
    // Rule priorities must be unique per listener. We can't safely
    // hash the session UUID into priority space (collisions ⇒ AWS
    // rejection), so we read the current rules and pick the next
    // free slot above the wildcard default. Priorities 1-100 are
    // reserved for the existing wildcard/bootstrap; sessions use
    // 1000+.
    //
    // DescribeRules→pick→CreateRule is non-atomic across concurrent
    // callers, so two simultaneous bring-ups can both grab the same
    // "next free" slot and the loser gets `PriorityInUse`. We retry
    // with monotonically incrementing priorities (rather than
    // re-DescribeRules every loop) up to MAX_PRIORITY_RETRIES — bounded
    // because priority space is 1..50000 and a runaway loop would
    // chew through the limit. Re-reading every retry would also work
    // but adds an ELB round-trip per attempt; this is cheaper and
    // converges in O(concurrent_starts) attempts.
    const MAX_PRIORITY_RETRIES = 5;
    const rules = await elbv2.send(
      new DescribeRulesCommand({ ListenerArn: args.listenerArn }),
    );
    const used = new Set<number>();
    for (const r of rules.Rules ?? []) {
      const p = parseInt(r.Priority ?? "0", 10);
      if (!Number.isNaN(p) && p >= 1000) used.add(p);
    }
    let priority = 1000;
    while (used.has(priority)) priority += 1;

    let attempt = 0;
    while (true) {
      try {
        const out = await elbv2.send(
          new CreateRuleCommand({
            ListenerArn: args.listenerArn,
            Priority: priority,
            Conditions: [{ Field: "host-header", Values: [args.host] }],
            Actions: [{ Type: "forward", TargetGroupArn: args.targetGroupArn }],
            Tags: [
              { Key: "App", Value: "openclaw" },
              { Key: "SessionId", Value: args.sessionId },
            ],
          }),
        );
        const ruleArn = out.Rules?.[0]?.RuleArn;
        if (!ruleArn) throw new Error("CreateRule returned no ARN");
        return ruleArn;
      } catch (err) {
        const collision = isPriorityCollision(err);
        if (!collision || attempt >= MAX_PRIORITY_RETRIES) {
          throw err;
        }
        attempt += 1;
        priority += 1;
        // Skip any priorities that have shown up as taken in the
        // initial read — concurrency-races aside, this also handles
        // the case where a separate listener-rule grew while we
        // were doing the AWS work.
        while (used.has(priority)) priority += 1;
        this.logger.warn(
          "createListenerRule: PriorityInUse, retrying with next slot",
          {
            sessionId: args.sessionId,
            attempt,
            priority,
          },
        );
      }
    }
  }

  private async resolveDefaultVpcId(infra: OpenclawInfra): Promise<string> {
    // VPC ID isn't in the SSM contract (the spec didn't anticipate
    // needing it), and target groups demand it explicitly. Resolve
    // it by reading the SG we already know about.
    const ec2 = await this.awsClients.getEc2();
    const { DescribeSecurityGroupsCommand } =
      await import("@aws-sdk/client-ec2");
    const out = await ec2.send(
      new DescribeSecurityGroupsCommand({
        GroupIds: [infra.taskSecurityGroupId],
      }),
    );
    const vpcId = out.SecurityGroups?.[0]?.VpcId;
    if (!vpcId) {
      throw new Error(
        `Could not resolve VPC ID from task SG ${infra.taskSecurityGroupId}`,
      );
    }
    return vpcId;
  }

  private async safeRollback(args: {
    clusterArn: string;
    taskArn: string;
    targetGroupArn?: string;
    listenerRuleArn?: string;
  }): Promise<void> {
    // Reverse order: rule → target group → task. Each step is
    // try/catch'd individually so a failure cleaning up one
    // resource doesn't block cleanup of the next.
    if (args.listenerRuleArn) {
      try {
        const elbv2 = await this.awsClients.getElbV2();
        const { DeleteRuleCommand } =
          await import("@aws-sdk/client-elastic-load-balancing-v2");
        await elbv2.send(
          new DeleteRuleCommand({ RuleArn: args.listenerRuleArn }),
        );
      } catch (err) {
        this.logger.warn("rollback: DeleteRule failed", {
          arn: args.listenerRuleArn,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (args.targetGroupArn) {
      try {
        const elbv2 = await this.awsClients.getElbV2();
        const { DeleteTargetGroupCommand } =
          await import("@aws-sdk/client-elastic-load-balancing-v2");
        await elbv2.send(
          new DeleteTargetGroupCommand({
            TargetGroupArn: args.targetGroupArn,
          }),
        );
      } catch (err) {
        this.logger.warn("rollback: DeleteTargetGroup failed", {
          arn: args.targetGroupArn,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    try {
      const ecs = await this.awsClients.getEcs();
      const { StopTaskCommand } = await import("@aws-sdk/client-ecs");
      await ecs.send(
        new StopTaskCommand({
          cluster: args.clusterArn,
          task: args.taskArn,
          reason: "openclaw session bring-up failed",
        }),
      );
    } catch (err) {
      this.logger.warn("rollback: StopTask failed", {
        arn: args.taskArn,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private sessionUrl(name: string, infra: OpenclawInfra): string {
    return `https://${name}.${infra.dnsSuffix}`;
  }

  private computeExpiresAt(startedAt: Date, wallClockMs: number): string {
    return new Date(startedAt.getTime() + wallClockMs).toISOString();
  }

  async stopSession(input: {
    sessionId: string;
    /** Whose request is this? `null` for system callers (reaper, stripe). */
    userId: string | null;
    reason: OpenclawStoppedReason;
    /**
     * Optional pre-loaded infra. When the caller has already resolved
     * the SSM contract for the current invocation (the reaper batch
     * does this once at the top of `reapExpiredSessions`), pass it in
     * to skip the redundant per-row `loadInfra()`. Saves N-1 SSM calls
     * across a batch — at 100 expired rows and SSM's 40 RPS account
     * limit per region, the unmemoised path collapsed to per-row
     * ThrottlingException after the first ~40 rows.
     *
     * `null` means "infra is known to be torn down — mark the row
     * stopped without AWS teardown" (matches the loader-throw branch).
     * `undefined` (the default) means "loadInfra yourself" — preserves
     * the existing single-call contract.
     */
    infra?: OpenclawInfra | null;
  }): Promise<StopSessionResult> {
    const row = await this.repository.findById(input.sessionId);
    if (!row || row.stoppedAt) {
      return { kind: "not_found" };
    }
    if (input.userId !== null && row.userId !== input.userId) {
      return { kind: "forbidden" };
    }

    // If the openclaw SST stack is torn down between session start
    // and DELETE, loadInfra throws OpenclawInfraNotDeployedError. The
    // AWS resources the row points at are gone with the stack, so
    // there's nothing for tearDownSessionResources to do — but the
    // ROW still needs marking stopped, otherwise the user is stuck:
    // their name stays locked by the partial unique index, the row
    // shows in GET /openclaw/sessions, and a fresh POST returns
    // "existing" with a URL that never resolves.
    //
    // Narrow catch — transient SSM failures (throttling, AccessDenied,
    // parse errors) MUST propagate. Swallowing them here would mark
    // the row stopped + skip AWS teardown while the AWS resources
    // are still running, silently leaking against the ALB rule and
    // target-group quotas.
    let infra: OpenclawInfra | null;
    if (input.infra !== undefined) {
      // Caller pre-loaded the contract (reaper batch). Skip the
      // round-trip; honour explicit `null` as "infra missing".
      infra = input.infra;
    } else {
      try {
        infra = await this.loadInfra();
      } catch (err) {
        if (err instanceof OpenclawInfraNotDeployedError) {
          this.logger.warn(
            "openclaw infra not deployed; skipping AWS teardown, " +
              "marking row stopped so the user can release it",
            { sessionId: row.id, error: err.message },
          );
          infra = null;
        } else {
          throw err;
        }
      }
    }

    if (infra) {
      await this.tearDownSessionResources({
        clusterArn: infra.clusterArn,
        taskArn: row.taskArn,
        targetGroupArn: row.targetGroupArn,
        listenerRuleArn: row.listenerRuleArn,
      });
    }
    await this.repository.markStopped(row.id, input.reason);
    return { kind: "stopped" };
  }

  /**
   * Tear down every active session owned by `userId`. Errors on
   * individual sessions are swallowed (logged) so a single AWS
   * failure can't strand the others — the Stripe webhook handler
   * is the primary caller and we never want a stuck cleanup to
   * break the cancellation pipeline.
   */
  async stopAllForUser(
    userId: string,
    reason: OpenclawStoppedReason,
  ): Promise<{ stopped: number; failed: number }> {
    const active = await this.repository.listActiveByUserId(userId);
    if (active.length === 0) return { stopped: 0, failed: 0 };

    // Same loader-throw guard as stopSession — if openclaw is torn
    // down the AWS resources are gone with it, but we still want the
    // rows marked stopped so the user isn't stuck. The Stripe
    // webhook (the primary caller) needs this path to converge even
    // when staging has been clean-slated.
    //
    // Narrow catch — same reasoning as stopSession. A transient SSM
    // throttle during a Stripe cancellation MUST surface so the
    // webhook returns non-2xx and Stripe retries; swallowing it here
    // would mark the rows stopped + leave ECS tasks running until
    // wall-clock timeout, leaking against ALB rule + target-group
    // quotas. Pre-narrowing this was the inspector's H-severity find
    // on PR #110 round 1.
    let infra: OpenclawInfra | null;
    try {
      infra = await this.loadInfra();
    } catch (err) {
      if (err instanceof OpenclawInfraNotDeployedError) {
        this.logger.warn(
          "openclaw infra not deployed; skipping AWS teardown for stopAllForUser",
          {
            userId,
            activeCount: active.length,
            error: err.message,
          },
        );
        infra = null;
      } else {
        throw err;
      }
    }

    let stopped = 0;
    let failed = 0;
    for (const row of active) {
      try {
        if (infra) {
          await this.tearDownSessionResources({
            clusterArn: infra.clusterArn,
            taskArn: row.taskArn,
            targetGroupArn: row.targetGroupArn,
            listenerRuleArn: row.listenerRuleArn,
          });
        }
        await this.repository.markStopped(row.id, reason);
        stopped += 1;
      } catch (err) {
        this.logger.error("stopAllForUser: session teardown failed", {
          userId,
          sessionId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
        failed += 1;
      }
    }
    return { stopped, failed };
  }

  /**
   * Phase 6 reaper entrypoint. Finds every active session whose
   * `started_at + tier.wallClockMs` is in the past, then stops each
   * via `stopSession` with `reason: "reaper"`. Called from the
   * EventBridge-scheduled Lambda in `apps/openclaw/infra/reaper.ts`.
   *
   * Idempotency: `stopSession` returns `not_found` for already-stopped
   * rows, so a previous run that crashed partway through is safely
   * re-runnable. Per-session errors are caught and counted — a single
   * stuck AWS call must not strand the rest of the batch (the Stripe
   * cancellation pattern in `stopAllForUser` proved this matters).
   *
   * When the openclaw SST stack is torn down (`OpenclawInfraNotDeployed
   * Error`), the reap is a no-op: the AWS resources the rows point at
   * are gone with the stack, and a subsequent stopSession would mark
   * the rows stopped via its own SSM-loader-throw guard. Letting the
   * reaper skip rather than partial-mark here keeps the "stack torn
   * down → user can release manually" recovery story simple.
   */
  async reapExpiredSessions(): Promise<{
    reaped: number;
    failed: number;
    notFound: number;
    scanned: number;
  }> {
    // Loader-throw guard — same shape as stopSession / stopAllForUser.
    // The narrow catch matches PR #110 round 1's inspector finding:
    // transient SSM failures (throttling / AccessDenied / parse errors)
    // MUST surface so the EventBridge invocation retries on the next
    // 15-min tick. Swallowing them here would make the reaper a silent
    // no-op for the duration of the transient, which is exactly the
    // kind of "running but doing nothing" failure mode CloudWatch
    // alarms exist to catch.
    //
    // CRITICAL: we resolve infra ONCE here and pass it through to each
    // per-row stopSession via the `infra` parameter. Without this
    // memoisation, stopSession's per-call loadInfra() fires N more
    // times during the batch — at 100 expired rows and SSM's 40 RPS
    // account limit, every run past ~40 rows hits ThrottlingException
    // and silently turns 60% of stopSession calls into per-row
    // failures. Inspector PR #113 found this. The memoised `infra`
    // also gets passed as `null` (not undefined) on the
    // NotDeployedError branch so stopSession knows the caller already
    // confirmed teardown should be skipped.
    let infra: OpenclawInfra;
    try {
      infra = await this.loadInfra();
    } catch (err) {
      if (err instanceof OpenclawInfraNotDeployedError) {
        this.logger.warn(
          "reaper: openclaw infra not deployed; skipping this run",
          { error: err.message },
        );
        return { reaped: 0, failed: 0, notFound: 0, scanned: 0 };
      }
      throw err;
    }

    const now = this.clock();
    const wallClockMsByTier = {
      free: getTierPolicy("free").wallClockMs,
      premium: getTierPolicy("premium").wallClockMs,
      enterprise: getTierPolicy("enterprise").wallClockMs,
    };
    const expired = await this.repository.listExpired(now, wallClockMsByTier);

    let reaped = 0;
    let failed = 0;
    let notFound = 0;
    for (const row of expired) {
      try {
        // `userId: null` flags this as a system call; stopSession's
        // ownership check is skipped (it's keyed on userId !== null).
        // `infra` is the pre-loaded contract — saves the redundant
        // SSM round-trip per row.
        const result = await this.stopSession({
          sessionId: row.id,
          userId: null,
          reason: "reaper",
          infra,
        });
        if (result.kind === "stopped") {
          reaped += 1;
          this.logger.info("reaper: stopped expired session", {
            sessionId: row.id,
            userId: row.userId,
            tier: row.tier,
            startedAt: row.startedAt.toISOString(),
            ageMs: now.getTime() - row.startedAt.getTime(),
          });
        } else if (result.kind === "not_found") {
          // Race: a parallel reaper run / user DELETE got there first
          // between listExpired and stopSession. Distinct from
          // `stopped` so a pattern of all-not-found (e.g. a bug in
          // findById vs listExpired alignment) is visible in the
          // metrics — Inspector PR #113 flagged the prior collapsed
          // "treat as reaped" path as masking a real bug class.
          notFound += 1;
          this.logger.info(
            "reaper: row already stopped before reaper got there",
            {
              sessionId: row.id,
              userId: row.userId,
              tier: row.tier,
            },
          );
        } else {
          // result.kind === "forbidden" — should not happen with
          // userId: null, but keep the branch closed.
          failed += 1;
          this.logger.error("reaper: unexpected stopSession result", {
            sessionId: row.id,
            kind: result.kind,
          });
        }
      } catch (err) {
        failed += 1;
        this.logger.error("reaper: stopSession threw", {
          sessionId: row.id,
          userId: row.userId,
          tier: row.tier,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    this.logger.info("reaper: run complete", {
      reaped,
      failed,
      notFound,
      scanned: expired.length,
    });
    return { reaped, failed, notFound, scanned: expired.length };
  }

  private async tearDownSessionResources(args: {
    clusterArn: string;
    taskArn: string;
    targetGroupArn: string;
    listenerRuleArn: string;
  }): Promise<void> {
    // Order: rule → target group → task. The whole call is
    // idempotent: each AWS delete swallows the "already gone" error
    // shape (RuleNotFoundException / TargetGroupNotFoundException /
    // ClusterNotFoundException) so a partial teardown can be retried.
    // Without this, a single bad first attempt would leave the row
    // stuck at `stopped_at IS NULL` forever — the user retries DELETE,
    // findById returns the same row, the AWS call re-throws on the
    // already-deleted resource, and `markStopped` never runs.
    const elbv2 = await this.awsClients.getElbV2();
    const {
      DeleteRuleCommand,
      DeleteTargetGroupCommand,
      DeregisterTargetsCommand,
      DescribeTargetHealthCommand,
    } = await import("@aws-sdk/client-elastic-load-balancing-v2");

    // Best-effort: deregister current targets first so the TG can be
    // deleted cleanly. ELB v2 sometimes complains if a TG still has
    // registered targets at delete time.
    try {
      const health = await elbv2.send(
        new DescribeTargetHealthCommand({
          TargetGroupArn: args.targetGroupArn,
        }),
      );
      const targets = (health.TargetHealthDescriptions ?? [])
        .map((t) => t.Target)
        .filter((t): t is NonNullable<typeof t> => !!t?.Id);
      if (targets.length > 0) {
        await elbv2.send(
          new DeregisterTargetsCommand({
            TargetGroupArn: args.targetGroupArn,
            Targets: targets,
          }),
        );
      }
    } catch (err) {
      this.logger.warn("tearDown: deregister targets failed (continuing)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await this.swallowNotFound(
      () =>
        elbv2.send(new DeleteRuleCommand({ RuleArn: args.listenerRuleArn })),
      "RuleNotFoundException",
      "DeleteRule",
    );
    await this.swallowNotFound(
      () =>
        elbv2.send(
          new DeleteTargetGroupCommand({
            TargetGroupArn: args.targetGroupArn,
          }),
        ),
      "TargetGroupNotFoundException",
      "DeleteTargetGroup",
    );

    const ecs = await this.awsClients.getEcs();
    const { StopTaskCommand } = await import("@aws-sdk/client-ecs");
    await this.swallowNotFound(
      () =>
        ecs.send(
          new StopTaskCommand({
            cluster: args.clusterArn,
            task: args.taskArn,
            reason: "openclaw session stopped",
          }),
        ),
      // ECS surfaces this as InvalidParameterException("The referenced
      // task does not exist") when the task is already gone, or
      // ClusterNotFoundException if the whole cluster is gone — accept
      // either as "already stopped".
      ["InvalidParameterException", "ClusterNotFoundException"],
      "StopTask",
    );
  }

  /**
   * Run `fn` and silently absorb a NotFound-shape error so the
   * stop path is idempotent. Re-throws anything else.
   */
  private async swallowNotFound(
    fn: () => Promise<unknown>,
    notFoundNames: string | string[],
    label: string,
  ): Promise<void> {
    const names = Array.isArray(notFoundNames)
      ? notFoundNames
      : [notFoundNames];
    try {
      await fn();
    } catch (err: unknown) {
      const e = err as { name?: string; Code?: string };
      const matched = names.some((n) => e?.name === n || e?.Code === n);
      if (!matched) throw err;
      this.logger.info(`tearDown: ${label} returned NotFound (already gone)`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
