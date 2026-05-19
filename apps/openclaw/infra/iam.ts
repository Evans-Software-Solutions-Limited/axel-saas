/**
 * IAM roles + security groups for the OpenClaw Fargate runtime.
 *
 * Two task-side roles per the spec (§4.2):
 *
 *   - **Task role** — assumed by the OpenClaw container at runtime.
 *     Phase 2 grants no permissions; Phase 5+ adds S3 reads, Secrets
 *     Manager reads, KMS decrypt as features need them. Empty-but-
 *     present so the task definition has something to reference and
 *     we don't churn the task def on first permission add.
 *
 *   - **Execution role** — assumed by ECS itself to pull the image
 *     and write logs. Standard AWS-managed policy attachment.
 *
 * The third role — the API caller role assumed by the core API
 * Lambda — lives in `apiCaller.ts` because it needs to reference
 * the cluster ARN and EFS file system ID, which would create a
 * circular import here.
 *
 * Three security groups per spec §9.2:
 *
 *   - **ALB SG** — public ingress on 443 only.
 *   - **Task SG** — ingress on 18789 from the ALB SG only; full
 *     egress (LLM APIs, MCP, integrations need it).
 *   - **EFS SG** — NFS port 2049 inbound from the task SG only.
 *
 * SGs live in IAM rather than their respective resource modules so
 * the cross-references (ALB ← task ← EFS) compose without circular
 * imports between `alb.ts`, `efs.ts`, and `taskDefinition.ts`.
 */

import { defaultVpc } from "./cluster";

// ─── Security groups ────────────────────────────────────────────────

/**
 * ALB security group — public-facing. HTTPS ingress from anywhere;
 * egress only to the task SG on the OpenClaw gateway port. Egress
 * is locked down (no `0.0.0.0/0`) because the ALB only needs to talk
 * to its targets, and a leaky egress policy on a public-facing SG is
 * a common compliance finding.
 */
export const albSecurityGroup = new aws.ec2.SecurityGroup("openclaw-alb-sg", {
  name: `openclaw-${$app.stage}-alb`,
  description: "OpenClaw ALB — public ingress on 443 only",
  vpcId: defaultVpc.id,
  ingress: [
    {
      protocol: "tcp",
      fromPort: 443,
      toPort: 443,
      cidrBlocks: ["0.0.0.0/0"],
      description: "HTTPS from anywhere — TLS terminates at the ALB",
    },
  ],
  // Egress rules added below — `ec2.SecurityGroupRule` so the rule
  // can reference the task SG without a circular declaration.
  egress: [],
});

/**
 * Task security group — applied to each OpenClaw container ENI at
 * RunTask time (in Phase 5; the SG is referenced from the task
 * definition's `networkConfiguration` then). Ingress is gated on
 * the ALB SG so a task's public IP isn't an attack surface;
 * egress is wide-open because OpenClaw needs to reach the LLM
 * provider, MCP servers, GitHub, etc.
 */
export const taskSecurityGroup = new aws.ec2.SecurityGroup("openclaw-task-sg", {
  name: `openclaw-${$app.stage}-task`,
  description:
    "OpenClaw Fargate task — ingress only from ALB SG; full egress for LLM + MCP traffic",
  vpcId: defaultVpc.id,
  // Ingress rule added below (after albSecurityGroup is fully
  // declared) so it can reference `albSecurityGroup.id`.
  ingress: [],
  egress: [
    {
      protocol: "-1",
      fromPort: 0,
      toPort: 0,
      cidrBlocks: ["0.0.0.0/0"],
      description: "Outbound LLM APIs, MCP servers, integration providers",
    },
  ],
});

new aws.ec2.SecurityGroupRule("openclaw-task-sg-ingress-from-alb", {
  type: "ingress",
  securityGroupId: taskSecurityGroup.id,
  protocol: "tcp",
  fromPort: 18789,
  toPort: 18789,
  sourceSecurityGroupId: albSecurityGroup.id,
  description: "Gateway port from ALB only",
});

new aws.ec2.SecurityGroupRule("openclaw-alb-sg-egress-to-tasks", {
  type: "egress",
  securityGroupId: albSecurityGroup.id,
  protocol: "tcp",
  fromPort: 18789,
  toPort: 18789,
  sourceSecurityGroupId: taskSecurityGroup.id,
  description: "ALB → task gateway port",
});

/**
 * EFS mount target security group — NFS (port 2049) from task SG
 * only. EFS mount targets sit in the same subnets as tasks; access
 * is gated entirely by this SG.
 */
export const efsSecurityGroup = new aws.ec2.SecurityGroup("openclaw-efs-sg", {
  name: `openclaw-${$app.stage}-efs`,
  description: "OpenClaw EFS — NFS from task SG only",
  vpcId: defaultVpc.id,
  ingress: [],
  // No outbound rules — EFS mount targets don't initiate connections.
  egress: [],
});

new aws.ec2.SecurityGroupRule("openclaw-efs-sg-ingress-from-tasks", {
  type: "ingress",
  securityGroupId: efsSecurityGroup.id,
  protocol: "tcp",
  fromPort: 2049,
  toPort: 2049,
  sourceSecurityGroupId: taskSecurityGroup.id,
  description: "NFS from task SG only",
});

// ─── Task-side IAM roles ────────────────────────────────────────────

/**
 * Trust policy that allows ECS tasks to assume a role. Shared by the
 * task role and the execution role.
 */
const ecsTasksAssumeRolePolicy = JSON.stringify({
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Principal: { Service: "ecs-tasks.amazonaws.com" },
      Action: "sts:AssumeRole",
    },
  ],
});

/**
 * Task role — assumed by the container itself. Empty-but-present
 * for Phase 2; Phase 5+ adds permissions as features need them
 * (S3 reads, Secrets Manager reads, KMS decrypt). Having the role
 * in place now means the task definition has a stable ARN to
 * reference; adding permissions later doesn't trigger a task-def
 * revision.
 */
export const taskRole = new aws.iam.Role("openclaw-task-role", {
  name: `openclaw-${$app.stage}-task`,
  assumeRolePolicy: ecsTasksAssumeRolePolicy,
  description:
    "OpenClaw runtime task role — phase 2 grants no permissions; phase 5+ adds S3, Secrets Manager, KMS as needed",
});

/**
 * Execution role — assumed by ECS itself (not the container) to
 * pull the image from ECR and stream stdout/stderr to CloudWatch
 * Logs. AWS-managed policy `AmazonECSTaskExecutionRolePolicy`
 * covers both.
 */
export const executionRole = new aws.iam.Role("openclaw-execution-role", {
  name: `openclaw-${$app.stage}-execution`,
  assumeRolePolicy: ecsTasksAssumeRolePolicy,
  description: "ECS-assumed role for image pull + CloudWatch Logs write",
});

new aws.iam.RolePolicyAttachment("openclaw-execution-role-managed", {
  role: executionRole.name,
  policyArn:
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
});
