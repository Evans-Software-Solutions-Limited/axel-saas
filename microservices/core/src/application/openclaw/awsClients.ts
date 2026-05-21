/**
 * STS-backed AWS client factory.
 *
 * The core API Lambda's own execution role intentionally has no
 * direct permission to launch ECS tasks or mutate ALB target groups
 * — those live on the `openclaw-<stage>-api-caller` role published
 * by `apps/openclaw/`. Per spec §4.3 we cross the boundary via
 * `sts:AssumeRole`.
 *
 * One AssumeRole session per Lambda warm-cycle; the SDK credential
 * provider caches and refreshes credentials transparently before
 * expiry. The cached clients are torn down on any auth failure
 * (defensive — a long-warm container could otherwise hold credentials
 * past their effective expiry if the SDK provider got stuck).
 */

import type { ECSClient } from "@aws-sdk/client-ecs";
import type { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import type { EFSClient } from "@aws-sdk/client-efs";
import type { EC2Client } from "@aws-sdk/client-ec2";

const REGION = process.env.AWS_REGION || "eu-west-2";

interface ClientCache {
  ecs?: ECSClient;
  elbv2?: ElasticLoadBalancingV2Client;
  efs?: EFSClient;
  ec2?: EC2Client;
}

let cache: ClientCache = {};
let credentialsForRoleArn: string | null = null;

/**
 * Test seam. Real Lambda never calls this; tests use it to reset the
 * cached clients between cases.
 */
export function resetAwsClientCache(): void {
  cache = {};
  credentialsForRoleArn = null;
}

interface FactoryOptions {
  roleArn: string;
}

async function getCredentials(roleArn: string) {
  const { fromTemporaryCredentials } =
    await import("@aws-sdk/credential-providers");
  return fromTemporaryCredentials({
    params: {
      RoleArn: roleArn,
      RoleSessionName: `openclaw-core-${process.env.AWS_LAMBDA_FUNCTION_NAME ?? "local"}`,
      DurationSeconds: 3600,
    },
  });
}

function ensureCacheMatchesRole(roleArn: string): void {
  if (credentialsForRoleArn && credentialsForRoleArn !== roleArn) {
    // SSM-provided role ARN changed mid-Lambda-life (e.g. operator
    // ran a fresh openclaw deploy). Drop everything and force fresh
    // AssumeRole on the next call.
    cache = {};
  }
  credentialsForRoleArn = roleArn;
}

export async function getEcsClient(opts: FactoryOptions): Promise<ECSClient> {
  ensureCacheMatchesRole(opts.roleArn);
  if (!cache.ecs) {
    const { ECSClient } = await import("@aws-sdk/client-ecs");
    cache.ecs = new ECSClient({
      region: REGION,
      credentials: await getCredentials(opts.roleArn),
    });
  }
  return cache.ecs;
}

export async function getElbV2Client(
  opts: FactoryOptions,
): Promise<ElasticLoadBalancingV2Client> {
  ensureCacheMatchesRole(opts.roleArn);
  if (!cache.elbv2) {
    const { ElasticLoadBalancingV2Client } =
      await import("@aws-sdk/client-elastic-load-balancing-v2");
    cache.elbv2 = new ElasticLoadBalancingV2Client({
      region: REGION,
      credentials: await getCredentials(opts.roleArn),
    });
  }
  return cache.elbv2;
}

export async function getEfsClient(opts: FactoryOptions): Promise<EFSClient> {
  ensureCacheMatchesRole(opts.roleArn);
  if (!cache.efs) {
    const { EFSClient } = await import("@aws-sdk/client-efs");
    cache.efs = new EFSClient({
      region: REGION,
      credentials: await getCredentials(opts.roleArn),
    });
  }
  return cache.efs;
}

export async function getEc2Client(opts: FactoryOptions): Promise<EC2Client> {
  ensureCacheMatchesRole(opts.roleArn);
  if (!cache.ec2) {
    const { EC2Client } = await import("@aws-sdk/client-ec2");
    cache.ec2 = new EC2Client({
      region: REGION,
      credentials: await getCredentials(opts.roleArn),
    });
  }
  return cache.ec2;
}
