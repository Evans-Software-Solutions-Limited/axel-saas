/**
 * ECS Fargate cluster + default-VPC discovery.
 *
 * Per the spec (§4.2 "VPC" + §13.3): **no new VPC is provisioned**.
 * We use the AWS default VPC in eu-west-2 and its default public
 * subnets. This is the single largest cost saving in the design
 * (~$130/month vs a dedicated VPC with NAT gateways).
 *
 * The default-VPC lookups exported here are consumed by the EFS,
 * ALB, IAM, and task-definition modules. Everything downstream
 * pivots off these IDs — if a future stage ever needs a non-default
 * VPC, this module is the single point to change.
 *
 * Why `aws.ecs.Cluster` (raw Pulumi) rather than `sst.aws.Cluster`:
 * the SST component is built around `sst.aws.Service` deployments,
 * which manage their own task definitions + ALB targets. We don't
 * use that model — the core API launches tasks at runtime via
 * `ecs:RunTask` against pre-registered task definitions. The raw
 * cluster resource keeps the surface honest about what's actually
 * happening.
 *
 * Security posture (per spec §9.2): tasks will run in the default
 * public subnets with `assign_public_ip = true` (required for ECR
 * image pull + outbound LLM/MCP traffic without a NAT). The task
 * security group (defined in `iam.ts`) blocks all ingress except
 * from the ALB — the public IP is a routing convenience, not an
 * attack surface.
 */

/**
 * The default VPC for this region. `aws.ec2.getVpc({ default: true })`
 * resolves at deploy time — if the account has no default VPC, the
 * deploy fails fast with a clear message. (Some accounts created
 * after 2022 don't have one by default; if that bites us, the fix
 * is to either create one manually with `aws ec2 create-default-vpc`
 * or migrate this module to provision a small dedicated VPC.)
 */
export const defaultVpc = await aws.ec2.getVpc({ default: true });

/**
 * The default subnets in the default VPC — one per AZ. ALB needs
 * subnets in at least two AZs (otherwise the AWS API rejects the
 * `aws.lb.LoadBalancer` create). EFS creates one mount target per
 * subnet, billed at zero idle cost. Tasks launch into the same set.
 */
export const defaultSubnets = await aws.ec2.getSubnets({
  filters: [
    { name: "vpc-id", values: [defaultVpc.id] },
    { name: "default-for-az", values: ["true"] },
  ],
});

/**
 * ECS cluster — Fargate-only. One per stage, named `openclaw-<stage>`
 * to match the spec's naming convention (§13.2).
 *
 * The cluster itself has no per-task cost; everything is billed at
 * the task level via the task definitions in `taskDefinition.ts`.
 * `containerInsights` would be a nice-to-have for runtime telemetry
 * but defaults off here — it's ~$0.02/hr/cluster regardless of task
 * count, and we don't have a dashboard consuming it yet. Add when
 * Phase 6 (CloudWatch alarms) needs the metrics.
 */
export const cluster = new aws.ecs.Cluster("openclaw-cluster", {
  name: `openclaw-${$app.stage}`,
  settings: [
    // Off by default — flip to "enabled" in Phase 6 when alarms are
    // wired up. Costs apply per-cluster, not per-task.
    { name: "containerInsights", value: "disabled" },
  ],
});

/**
 * Explicitly opt into Fargate capacity providers. Without this the
 * cluster default would force a `RunTask` caller to specify
 * `launchType: "FARGATE"` on every call; with it, the cluster
 * accepts plain Fargate tasks with no extra plumbing on the API
 * side. `FARGATE_SPOT` is included for the Free-tier-on-Spot cost
 * optimisation flagged in spec §14.5.4 — opt-in only, defaults off.
 */
new aws.ecs.ClusterCapacityProviders("openclaw-cluster-providers", {
  clusterName: cluster.name,
  capacityProviders: ["FARGATE", "FARGATE_SPOT"],
  defaultCapacityProviderStrategies: [
    {
      capacityProvider: "FARGATE",
      weight: 1,
      base: 0,
    },
  ],
});
