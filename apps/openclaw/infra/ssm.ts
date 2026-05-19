/**
 * Cross-stack contract: SSM Parameter Store writes.
 *
 * Per spec §4.3 — the core API needs to know, at runtime, several
 * IDs / ARNs owned by THIS SST app: cluster ARN, task definition
 * ARNs, subnet IDs, security group ID, EFS file system ID, ALB
 * listener ARN, API caller role ARN. We do NOT use SST's
 * cross-stack output mechanism (deliberate per spec §1) because
 * we want the two apps to remain independently deployable and
 * revertible.
 *
 * Instead, we write to SSM Parameter Store under
 * `/axel/<stage>/openclaw/*`. The core API reads these at boot.
 *
 * **Phase 2 publishes everything except `hosted-zone-id`** — that's
 * a Phase 3 deliverable (when DNS is wired up). Until then, the
 * core API doesn't need it (it can't launch sessions yet anyway —
 * that's Phase 5).
 *
 * Why one parameter per concern rather than a single JSON blob:
 *   - `aws ssm get-parameter --name /axel/<stage>/openclaw/cluster-arn`
 *     is the spec's literal verification command — keeping it
 *     callable as-written.
 *   - SSM Parameter Store charges by parameter at deploy time, not
 *     fetch time, so the cost difference is negligible.
 *   - Per-parameter IAM scoping is finer-grained than a single blob.
 *
 * Task definition ARNs are the exception — they're packed into a
 * single JSON parameter (`task-definition-arns`) keyed by tier
 * because Phase 5 always needs all three at once (the API picks
 * the right one based on the authenticated user's tier).
 */

import { apiCallerRole } from "./apiCaller";
import { listener, loadBalancer } from "./alb";
import { cluster, defaultSubnets } from "./cluster";
import { fileSystem } from "./efs";
import { taskSecurityGroup } from "./iam";
import { taskDefinitionArns } from "./taskDefinition";

const prefix = `/axel/${$app.stage}/openclaw`;

new aws.ssm.Parameter("openclaw-ssm-cluster-arn", {
  name: `${prefix}/cluster-arn`,
  type: "String",
  value: cluster.arn,
  description: "ECS cluster ARN for OpenClaw Fargate tasks",
});

new aws.ssm.Parameter("openclaw-ssm-task-definition-arns", {
  name: `${prefix}/task-definition-arns`,
  type: "String",
  // JSON-encoded `{ free, premium, enterprise }` map — the core API
  // parses this at boot and indexes by the authenticated user's tier.
  value: $util
    .all([
      taskDefinitionArns.free,
      taskDefinitionArns.premium,
      taskDefinitionArns.enterprise,
    ])
    .apply(([free, premium, enterprise]) =>
      JSON.stringify({ free, premium, enterprise }),
    ),
  description:
    "JSON map: tier → ECS task definition ARN. Keys: free, premium, enterprise.",
});

new aws.ssm.Parameter("openclaw-ssm-subnet-ids", {
  name: `${prefix}/subnet-ids`,
  type: "StringList",
  // SSM StringList is comma-separated.
  value: defaultSubnets.ids.join(","),
  description:
    "Default-VPC public subnet IDs (comma-separated) used by RunTask network config",
});

new aws.ssm.Parameter("openclaw-ssm-task-security-group-id", {
  name: `${prefix}/task-security-group-id`,
  type: "String",
  value: taskSecurityGroup.id,
  description:
    "Security group applied to OpenClaw Fargate task ENIs; ingress only from ALB SG on 18789",
});

new aws.ssm.Parameter("openclaw-ssm-efs-file-system-id", {
  name: `${prefix}/efs-file-system-id`,
  type: "String",
  value: fileSystem.id,
  description:
    "EFS file system ID for OpenClaw workspaces; per-user access points are created on demand",
});

new aws.ssm.Parameter("openclaw-ssm-alb-listener-arn", {
  name: `${prefix}/alb-listener-arn`,
  type: "String",
  value: listener.arn,
  description:
    "ALB listener ARN; the core API adds per-session host-based rules against this listener",
});

new aws.ssm.Parameter("openclaw-ssm-alb-dns-name", {
  name: `${prefix}/alb-dns-name`,
  type: "String",
  value: loadBalancer.dnsName,
  description:
    "ALB DNS name (the Phase-3 wildcard ALIAS record points at this). Exported for manual smoke tests in Phase 2.",
});

new aws.ssm.Parameter("openclaw-ssm-api-caller-role-arn", {
  name: `${prefix}/api-caller-role-arn`,
  type: "String",
  value: apiCallerRole.arn,
  description:
    "IAM role the core API Lambda assumes via STS for per-session lifecycle calls",
});
