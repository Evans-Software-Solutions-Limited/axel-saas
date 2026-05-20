/**
 * EFS file system for OpenClaw user workspaces.
 *
 * One file system per stage; per-user access points are created
 * lazily by the core API at session start (Phase 5). The access
 * point sets POSIX UID/GID per user and pins the user's root to
 * `/users/<userId>`, so a single file system serves all users
 * with no cross-user visibility.
 *
 * Per spec §4.2 + §14:
 *   - Standard throughput mode (burst), not provisioned. Idle EFS
 *     storage is ~$0.30/GB-month at Standard tier; we'll switch
 *     to provisioned only if telemetry shows sustained throughput
 *     contention.
 *   - Encrypted at rest with the AWS-managed EFS key (no custom
 *     KMS key — saves $1/month on the key and the rotation
 *     management overhead; the AWS-managed key is fine for the
 *     workspace data).
 *   - Lifecycle transition to Infrequent Access (IA) after 30 days
 *     of no access — spec §14.5.5 flags this as a cheap saving for
 *     dormant workspaces.
 */

import { defaultSubnets } from "./cluster";
import { efsSecurityGroup } from "./iam";

export const fileSystem = new aws.efs.FileSystem("openclaw-fs", {
  creationToken: `openclaw-${$app.stage}`,
  encrypted: true,
  performanceMode: "generalPurpose",
  throughputMode: "bursting",
  lifecyclePolicies: [
    {
      transitionToIa: "AFTER_30_DAYS",
    },
    {
      // Brings IA-tiered files back to Standard on first access —
      // smooths over the IA latency penalty if a dormant workspace
      // suddenly becomes active again.
      transitionToPrimaryStorageClass: "AFTER_1_ACCESS",
    },
  ],
});

/**
 * Mount targets — one per default subnet, sharing the EFS SG defined
 * in `iam.ts`. ECS tasks across AZs use the closest mount target.
 *
 * `Pulumi.all` resolves the subnet IDs from `aws.ec2.getSubnets` at
 * deploy time. The array length is the number of default AZs in
 * eu-west-2 (3 at the time of writing — eu-west-2a/b/c).
 */
export const mountTargets = defaultSubnets.ids.map(
  (subnetId, index) =>
    new aws.efs.MountTarget(`openclaw-fs-mt-${index}`, {
      fileSystemId: fileSystem.id,
      subnetId,
      securityGroups: [efsSecurityGroup.id],
    }),
);
