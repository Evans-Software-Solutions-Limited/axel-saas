/**
 * Phase 6 reaper Lambda — production wiring.
 *
 * Triggered every 15 minutes by an EventBridge schedule defined in
 * `apps/openclaw/infra/reaper.ts`. This file's only job is to wire
 * the production deps (real DB, AWS SDK clients with default Lambda
 * execution-role creds, CloudWatch PutMetricData) into the testable
 * factory exported from `reaperRunner.ts`.
 *
 * All business logic lives in `reaperRunner.buildHandler` and is
 * unit-tested there. This file is excluded from coverage (same as
 * the other `*Handler.ts` files in this directory) because everything
 * left here is dynamic AWS SDK init + Lambda glue, which has no
 * branch behaviour worth asserting on in isolation — the AWS SDK's
 * own tests cover the SDK side, the service tests cover ours.
 *
 * Spec reference: `docs/openclaw-fargate-spec.md` §6 + §10.
 */

import { getDb } from "@axel-saas/db";
import type { ECSClient } from "@aws-sdk/client-ecs";
import type { ElasticLoadBalancingV2Client } from "@aws-sdk/client-elastic-load-balancing-v2";
import type { EFSClient } from "@aws-sdk/client-efs";
import type { EC2Client } from "@aws-sdk/client-ec2";
import type { CloudWatchClient } from "@aws-sdk/client-cloudwatch";

import { OpenclawSessionsRepository } from "./openclawSessionsRepository";
import {
  OpenclawSessionsService,
  type AwsClientFactory,
} from "./openclawSessionsService";
import { getOpenclawInfra } from "./ssmContract";
import { buildHandler, type ReaperRunResult } from "./reaperRunner";

export type { ReaperRunResult };

const REGION = process.env.AWS_REGION || "eu-west-2";
const METRIC_NAMESPACE = "Axel/Openclaw/Reaper";

const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    console.log(`[openclaw-reaper] ${msg}`, ctx ?? {}),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    console.warn(`[openclaw-reaper] ${msg}`, ctx ?? {}),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    console.error(`[openclaw-reaper] ${msg}`, ctx ?? {}),
};

/**
 * The reaper Lambda's execution role has direct IAM grants for the
 * AWS APIs it needs (ecs:StopTask, elbv2 deletes, ssm:GetParameter).
 * Unlike the core API — which uses STS AssumeRole to cross the
 * cross-stack boundary — the reaper is *in* the openclaw stack and
 * just uses its own role.
 *
 * Lazy init so a cold Lambda that catches a transient AWS init
 * failure doesn't burn the whole 15-min interval before its next
 * chance: the next invocation will recreate the client.
 */
function buildAwsClientFactory(): AwsClientFactory {
  let ecs: ECSClient | undefined;
  let elbv2: ElasticLoadBalancingV2Client | undefined;
  let efs: EFSClient | undefined;
  let ec2: EC2Client | undefined;
  return {
    async getEcs() {
      if (!ecs) {
        const { ECSClient } = await import("@aws-sdk/client-ecs");
        ecs = new ECSClient({ region: REGION });
      }
      return ecs;
    },
    async getElbV2() {
      if (!elbv2) {
        const { ElasticLoadBalancingV2Client } =
          await import("@aws-sdk/client-elastic-load-balancing-v2");
        elbv2 = new ElasticLoadBalancingV2Client({ region: REGION });
      }
      return elbv2;
    },
    async getEfs() {
      if (!efs) {
        const { EFSClient } = await import("@aws-sdk/client-efs");
        efs = new EFSClient({ region: REGION });
      }
      return efs;
    },
    async getEc2() {
      if (!ec2) {
        const { EC2Client } = await import("@aws-sdk/client-ec2");
        ec2 = new EC2Client({ region: REGION });
      }
      return ec2;
    },
  };
}

let cwClient: CloudWatchClient | undefined;

async function getCloudWatchClient(): Promise<CloudWatchClient> {
  if (!cwClient) {
    const { CloudWatchClient } = await import("@aws-sdk/client-cloudwatch");
    cwClient = new CloudWatchClient({ region: REGION });
  }
  return cwClient;
}

/**
 * Best-effort PutMetricData. A CloudWatch outage MUST NOT cascade
 * into a Lambda invocation failure (the built-in Lambda Errors metric
 * would then flag a fake outage). Log + swallow.
 */
async function emitMetrics(
  result: { reaped: number; failed: number },
  stage: string,
): Promise<void> {
  try {
    const cw = await getCloudWatchClient();
    const { PutMetricDataCommand } = await import("@aws-sdk/client-cloudwatch");
    await cw.send(
      new PutMetricDataCommand({
        Namespace: METRIC_NAMESPACE,
        MetricData: [
          {
            MetricName: "ReapSuccess",
            Value: result.reaped,
            Unit: "Count",
            Dimensions: [{ Name: "Stage", Value: stage }],
          },
          {
            MetricName: "ReapFailure",
            Value: result.failed,
            Unit: "Count",
            Dimensions: [{ Name: "Stage", Value: stage }],
          },
        ],
      }),
    );
  } catch (err) {
    logger.warn("reaper: PutMetricData failed (non-fatal)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * EventBridge invocation entrypoint. The runtime supplies an event
 * payload (the scheduled rule's input) — we don't use it; the work
 * is fixed per invocation.
 */
export const handler = async (): Promise<ReaperRunResult> => {
  const db = getDb();
  const repository = new OpenclawSessionsRepository(db);
  const service = new OpenclawSessionsService({
    repository,
    loadInfra: () => getOpenclawInfra(),
    awsClients: buildAwsClientFactory(),
    logger,
    gatewayToken: process.env.OPENCLAW_GATEWAY_TOKEN || null,
  });
  return buildHandler({ service, emitMetrics, logger })();
};
