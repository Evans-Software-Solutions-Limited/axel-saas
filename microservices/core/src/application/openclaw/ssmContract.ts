/**
 * Cross-stack contract loader.
 *
 * The OpenClaw Fargate runtime is owned by a separate SST app
 * (`apps/openclaw/`) which publishes the IDs the core API needs at
 * runtime to `/axel/<stage>/openclaw/*` SSM parameters. Per spec
 * §4.3 we deliberately do NOT consume SST stack outputs across apps
 * — the two stacks must be independently deployable and revertible.
 *
 * This module is the only place that reads from those parameters.
 * The contract is fetched once per Lambda cold start (lazy, on first
 * call), cached, and never refreshed within a single Lambda
 * instance. A new deploy → new container → new fetch.
 *
 * On dev stages, `hosted-zone-id` is intentionally absent — `dns.ts`
 * in the openclaw SST app skips writing it when no zone exists for
 * the stage. The loader returns `null` for that field rather than
 * failing; the session-creation handler treats a missing zone as
 * "feature disabled on this stage" and returns 503.
 */

import { getStage } from "./stage";

export interface OpenclawInfra {
  clusterArn: string;
  taskDefinitionArns: {
    free: string;
    premium: string;
    enterprise: string;
  };
  /** Comma-split, ready to pass to ECS network config. */
  subnetIds: string[];
  taskSecurityGroupId: string;
  efsFileSystemId: string;
  albListenerArn: string;
  albDnsName: string;
  apiCallerRoleArn: string;
  /** Null on dev stages where no Route53 zone exists. */
  hostedZoneId: string | null;
  /**
   * The DNS suffix sessions are served under, e.g.
   * `openclaw.staging.meetaxel.ai`. Derived from the stage name
   * because the openclaw SST app publishes the hosted-zone ID but
   * not the human-readable name, and the (stage → zone) mapping is
   * fixed by spec §9.1. Null on dev stages, in lock-step with
   * `hostedZoneId`.
   */
  dnsSuffix: string | null;
}

/**
 * Per-stage DNS suffix per spec §9.1. Stages outside this map are
 * dev / personal stages with no hosted zone — sessions are addressed
 * via the raw ALB DNS in those, but session creation is disabled
 * regardless because the wildcard cert isn't issued.
 */
const STAGE_DNS_SUFFIX: Record<string, string> = {
  production: "openclaw.meetaxel.ai",
  staging: "openclaw.staging.meetaxel.ai",
};

export interface SsmReader {
  get(name: string): Promise<string | undefined>;
}

/**
 * Default reader — dynamic-import keeps the SDK out of cold-start
 * for code paths that never touch SSM (the chat handler, settings,
 * stripe, etc).
 */
export class AwsSsmReader implements SsmReader {
  private client: import("@aws-sdk/client-ssm").SSMClient | null = null;

  private async getClient() {
    if (!this.client) {
      const { SSMClient } = await import("@aws-sdk/client-ssm");
      this.client = new SSMClient({ region: process.env.AWS_REGION });
    }
    return this.client;
  }

  async get(name: string): Promise<string | undefined> {
    const client = await this.getClient();
    const { GetParameterCommand } = await import("@aws-sdk/client-ssm");
    try {
      const out = await client.send(
        new GetParameterCommand({ Name: name, WithDecryption: false }),
      );
      return out.Parameter?.Value;
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e?.name === "ParameterNotFound") return undefined;
      throw err;
    }
  }
}

let cached: Promise<OpenclawInfra> | null = null;

/**
 * Test seam: drop the cached promise so the next call refetches.
 * The real Lambda never invokes this — tests do.
 */
export function resetOpenclawInfraCache(): void {
  cached = null;
}

export async function getOpenclawInfra(
  reader: SsmReader = new AwsSsmReader(),
  stage: string = getStage(),
): Promise<OpenclawInfra> {
  if (!cached) {
    cached = loadOpenclawInfra(reader, stage).catch((err) => {
      // Don't poison the cache with a rejected promise — next caller
      // gets a fresh attempt. SSM reads can fail transiently on a
      // cold-start ENI shortage and we want the second invocation
      // to retry rather than serve stale errors for the life of the
      // container.
      cached = null;
      throw err;
    });
  }
  return cached;
}

async function loadOpenclawInfra(
  reader: SsmReader,
  stage: string,
): Promise<OpenclawInfra> {
  const prefix = `/axel/${stage}/openclaw`;

  const [
    clusterArn,
    taskDefinitionArnsJson,
    subnetIdsCsv,
    taskSecurityGroupId,
    efsFileSystemId,
    albListenerArn,
    albDnsName,
    apiCallerRoleArn,
    hostedZoneId,
  ] = await Promise.all([
    reader.get(`${prefix}/cluster-arn`),
    reader.get(`${prefix}/task-definition-arns`),
    reader.get(`${prefix}/subnet-ids`),
    reader.get(`${prefix}/task-security-group-id`),
    reader.get(`${prefix}/efs-file-system-id`),
    reader.get(`${prefix}/alb-listener-arn`),
    reader.get(`${prefix}/alb-dns-name`),
    reader.get(`${prefix}/api-caller-role-arn`),
    reader.get(`${prefix}/hosted-zone-id`),
  ]);

  const required: Record<string, string | undefined> = {
    "cluster-arn": clusterArn,
    "task-definition-arns": taskDefinitionArnsJson,
    "subnet-ids": subnetIdsCsv,
    "task-security-group-id": taskSecurityGroupId,
    "efs-file-system-id": efsFileSystemId,
    "alb-listener-arn": albListenerArn,
    "alb-dns-name": albDnsName,
    "api-caller-role-arn": apiCallerRoleArn,
  };
  for (const [k, v] of Object.entries(required)) {
    if (!v) {
      throw new Error(
        `Missing SSM parameter ${prefix}/${k} (the openclaw SST app must be deployed to this stage first)`,
      );
    }
  }

  let taskDefinitionArns: OpenclawInfra["taskDefinitionArns"];
  try {
    taskDefinitionArns = JSON.parse(
      taskDefinitionArnsJson!,
    ) as OpenclawInfra["taskDefinitionArns"];
  } catch (err: unknown) {
    throw new Error(
      `${prefix}/task-definition-arns is not valid JSON: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  for (const tier of ["free", "premium", "enterprise"] as const) {
    if (!taskDefinitionArns[tier]) {
      throw new Error(
        `${prefix}/task-definition-arns is missing tier "${tier}"`,
      );
    }
  }

  return {
    clusterArn: clusterArn!,
    taskDefinitionArns,
    subnetIds: subnetIdsCsv!
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    taskSecurityGroupId: taskSecurityGroupId!,
    efsFileSystemId: efsFileSystemId!,
    albListenerArn: albListenerArn!,
    albDnsName: albDnsName!,
    apiCallerRoleArn: apiCallerRoleArn!,
    hostedZoneId: hostedZoneId ?? null,
    dnsSuffix: hostedZoneId ? (STAGE_DNS_SUFFIX[stage] ?? null) : null,
  };
}
