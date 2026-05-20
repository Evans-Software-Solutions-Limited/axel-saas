/// <reference path="./.sst/platform/config.d.ts" />

/**
 * `openclaw` — a **separate, independent SST v3 app** from the root
 * `axel-saas` SST config at the repo root. Same AWS accounts, same
 * stages, but no cross-stack `sst.Linkable` references. The boundary
 * is intentional per `docs/openclaw-fargate-spec.md` §1 — the core
 * API treats this app as a foreign dependency and reads the
 * cross-stack contract values from SSM Parameter Store under
 * `/axel/<stage>/openclaw/*` (see `infra/ssm.ts`).
 *
 * Phases delivered so far:
 *   - Phase 2: ECR, ECS cluster, EFS, IAM roles, ALB with default
 *     404 listener, task definitions for all three tiers, SSM
 *     parameter writes.
 *   - Phase 3 (this update): Route53 wildcard ALIAS + ACM wildcard
 *     cert + HTTPS-443 listener (HTTP-80 on dev). `infra/dns.ts`,
 *     hosted-zone-id added to SSM cross-stack contract.
 *
 * Still to come: Phase 4 (GitHub deploy workflow), Phase 5 (per-user
 * RunTask + session lifecycle in the core API), Phase 6 (reaper +
 * alarms).
 *
 * Stage vocabulary note: the spec uses "preprod" throughout, but the
 * code's existing stages (per `infra/domains/`) are `staging` and
 * `production`. This SST app deploys to the same stage names as the
 * root app — `staging`, `production`, plus arbitrary dev stages.
 */
export default $config({
  app(input) {
    const stage = input?.stage ?? "dev";
    return {
      name: "openclaw",
      removal: stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(stage),
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-2",
          defaultTags: {
            tags: {
              App: "openclaw",
              Stage: stage,
            },
          },
        },
      },
    };
  },
  async run() {
    // Order matters: IAM roles must exist before the task definition
    // can reference them; the cluster + EFS + ECR must exist before
    // task definition wires their ARNs into the container; the ALB
    // must exist before SSM can record its listener ARN. SSM writes
    // last so the cross-stack contract is only published after every
    // upstream resource is present.
    //
    // Why `apiCaller.ts` is a separate import from `iam.ts`: the API
    // caller role's inline policy references cluster.arn + efs.arn,
    // which would create a circular import if it lived alongside the
    // security groups (efs.ts depends on iam.ts for the EFS SG).
    const ecr = await import("./infra/ecr");
    await import("./infra/iam");
    const cluster = await import("./infra/cluster");
    const efs = await import("./infra/efs");
    const apiCaller = await import("./infra/apiCaller");
    // dns.ts MUST load before alb.ts — the listener attaches the
    // ACM cert that dns.ts owns. On dev stages dns.ts exports null
    // and alb.ts falls back to its Phase 2 HTTP-80 listener.
    const dns = await import("./infra/dns");
    const alb = await import("./infra/alb");
    const taskDef = await import("./infra/taskDefinition");
    await import("./infra/ssm");

    return {
      ecrRepositoryUrl: ecr.repository.repositoryUrl,
      ecsClusterArn: cluster.cluster.arn,
      // Per-tier ARNs — `taskDef.taskDefinitionArns` is a record keyed
      // by `free | premium | enterprise`.
      ecsTaskDefinitionArnFree: taskDef.taskDefinitionArns.free,
      ecsTaskDefinitionArnPremium: taskDef.taskDefinitionArns.premium,
      ecsTaskDefinitionArnEnterprise: taskDef.taskDefinitionArns.enterprise,
      albDnsName: alb.loadBalancer.dnsName,
      albListenerArn: alb.listener.arn,
      // `null` on dev stages where there's no hosted zone — outputs
      // record the null literally so `sst output` shows the dev-stage
      // state honestly rather than crashing.
      hostedZoneId: dns.zoneId,
      wildcardName: dns.wildcardName,
      efsFileSystemId: efs.fileSystem.id,
      apiCallerRoleArn: apiCaller.apiCallerRole.arn,
    };
  },
});
