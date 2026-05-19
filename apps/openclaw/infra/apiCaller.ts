/**
 * API caller IAM role — assumed by the core API Lambda via STS to
 * launch + stop OpenClaw tasks and manage their ALB target groups
 * + EFS access points + Route53 records.
 *
 * Lives in its own file (rather than inside `iam.ts`) because the
 * inline policy needs `cluster.arn` and `fileSystem.arn` — putting
 * this in `iam.ts` would create a circular import with `efs.ts`,
 * which in turn imports the EFS security group from `iam.ts`.
 *
 * **Phase 2 scope:** create the role with the documented permissions;
 * leave the trust policy pointing at the account root. The core API
 * Lambda doesn't actually assume this role until Phase 5 — what
 * Phase 5 will do is (a) replace the trust principal with the
 * Lambda's execution role ARN and (b) grant the Lambda's role
 * `sts:AssumeRole` on this role's ARN. Phase 2 keeps the role
 * present-but-unassumable-from-outside-IAM so the cross-stack
 * contract surface (SSM, see `ssm.ts`) is complete.
 */

import { cluster } from "./cluster";
import { fileSystem } from "./efs";
import { executionRole, taskRole } from "./iam";

const callerIdentity = await aws.getCallerIdentity({});

export const apiCallerRole = new aws.iam.Role("openclaw-api-caller-role", {
  name: `openclaw-${$app.stage}-api-caller`,
  description:
    "Assumed by the core API Lambda via STS; grants ecs:RunTask + ALB target-group + EFS access-point + Route53 changes per spec §4.2",
  // Account-root principal: any IAM principal in this account that's
  // been explicitly granted `sts:AssumeRole` on this role can assume
  // it. Phase 5 will narrow this to the specific core API Lambda's
  // execution role ARN, but for Phase 2 we don't know what that ARN
  // will be (it's owned by the root `axel-saas` SST app), and
  // hard-coding a placeholder ARN would silently fail to refresh on
  // Phase 5 deploy. The "any account principal with explicit grant"
  // shape is the standard pattern and is safe because the grant
  // itself is what authorises the assume — without it, nothing can
  // use this role.
  assumeRolePolicy: JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          AWS: `arn:aws:iam::${callerIdentity.accountId}:root`,
        },
        Action: "sts:AssumeRole",
      },
    ],
  }),
});

/**
 * The permission bundle the API caller role needs. Scoped narrowly:
 *
 *   - `ecs:RunTask`/`StopTask`/`DescribeTasks` — confined to this
 *     stage's cluster ARN via `ecs:cluster` condition.
 *   - `iam:PassRole` — only on the task + execution roles. Without
 *     this scope, a compromised core API could pass ANY role into a
 *     task and effectively privilege-escalate. The
 *     `iam:PassedToService` condition belt-and-braces it to the ECS
 *     service principal.
 *   - `elasticloadbalancing:*` (target group + listener rule subset)
 *     — region-scoped; per-resource scoping isn't possible because
 *     the API creates+destroys target groups on the fly with names
 *     it picks at runtime.
 *   - `elasticfilesystem:CreateAccessPoint/Delete/Describe` — scoped
 *     to the file system ARN.
 *   - `route53:ChangeResourceRecordSets` — Phase 3 will narrow this
 *     to the actual hosted zone ARN. Phase 2 over-permissions with
 *     `*` because the role isn't assumable by anything outside this
 *     stack until Phase 5 wires it up, so the temporary breadth is
 *     unreachable.
 */
new aws.iam.RolePolicy("openclaw-api-caller-inline", {
  role: apiCallerRole.id,
  policy: $util
    .all([cluster.arn, fileSystem.arn, taskRole.arn, executionRole.arn])
    .apply(([clusterArn, efsArn, taskRoleArn, executionRoleArn]) => {
      const policy = {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "EcsLifecycle",
            Effect: "Allow",
            Action: [
              "ecs:RunTask",
              "ecs:StopTask",
              "ecs:DescribeTasks",
              "ecs:ListTasks",
            ],
            // RunTask scoping has to use the cluster ARN as a
            // condition rather than as the resource (the resource
            // ARN slot is for the task definition). Belt-and-braces:
            // gate every call on this stage's cluster.
            Resource: "*",
            Condition: {
              ArnEquals: { "ecs:cluster": clusterArn },
            },
          },
          {
            Sid: "PassRolesToTask",
            Effect: "Allow",
            Action: "iam:PassRole",
            Resource: [taskRoleArn, executionRoleArn],
            Condition: {
              StringEquals: {
                "iam:PassedToService": "ecs-tasks.amazonaws.com",
              },
            },
          },
          {
            Sid: "AlbTargetAndRule",
            Effect: "Allow",
            Action: [
              "elasticloadbalancing:CreateTargetGroup",
              "elasticloadbalancing:DeleteTargetGroup",
              "elasticloadbalancing:DescribeTargetGroups",
              "elasticloadbalancing:RegisterTargets",
              "elasticloadbalancing:DeregisterTargets",
              "elasticloadbalancing:CreateRule",
              "elasticloadbalancing:DeleteRule",
              "elasticloadbalancing:ModifyRule",
              "elasticloadbalancing:DescribeRules",
              "elasticloadbalancing:DescribeListeners",
            ],
            Resource: "*",
          },
          {
            Sid: "EfsAccessPoints",
            Effect: "Allow",
            Action: [
              "elasticfilesystem:CreateAccessPoint",
              "elasticfilesystem:DeleteAccessPoint",
              "elasticfilesystem:DescribeAccessPoints",
            ],
            Resource: efsArn,
          },
          {
            Sid: "Route53RecordsPlaceholder",
            Effect: "Allow",
            Action: [
              "route53:ChangeResourceRecordSets",
              "route53:ListResourceRecordSets",
            ],
            // Phase 3 narrows this to the actual hosted zone.
            Resource: "*",
          },
        ],
      };
      return JSON.stringify(policy);
    }),
});
