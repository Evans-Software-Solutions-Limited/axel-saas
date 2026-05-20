/**
 * ECS task definitions — one revision per tier (Free / Premium /
 * Enterprise) with the per-tier (vCPU, memory) baked in.
 *
 * Why one definition per tier rather than one definition with
 * per-task overrides: Fargate only accepts specific (vCPU, memory)
 * pairs, so pre-registering valid combinations avoids the
 * "InvalidParameterException" foot-gun the core API would hit if it
 * tried to override CPU on a single shared family.
 *
 * Per spec §7.5 (tier policy):
 *
 *   | Tier       | vCPU | Memory | Wall-clock |
 *   | ---------- | ---- | ------ | ---------- |
 *   | Free       | 512  | 1 GB   | 1h         |
 *   | Premium    | 1024 | 2 GB   | 8h         |
 *   | Enterprise | 2048 | 4 GB   | 24h        |
 *
 * The wall-clock caps live on the Phase 6 reaper, not here — task
 * definitions don't carry wall-clock metadata at the AWS level.
 *
 * The image URI uses the `:bootstrap` tag — Phase 2 explicitly
 * expects the operator to push a single bootstrap image to ECR
 * by hand to validate the pipeline before Phase 4 (the deploy
 * workflow) takes over per-commit pushes. Until that bootstrap
 * push happens, RunTask attempts against these task defs will fail
 * with an ECR "image not found" error, which is the right failure
 * mode — the spec exit criteria for Phase 2 don't include running a
 * task, only `sst deploy` succeeding + ALB returning 404 + SSM
 * params being populated.
 */

import { repository } from "./ecr";
import { fileSystem } from "./efs";
import { executionRole, taskRole } from "./iam";

/**
 * Tier sizing — matches `tierPolicy.ts` in the core API. Keeping
 * the numbers here as raw values (not importing from the core API)
 * because the two apps are deliberately independent (spec §1
 * "no cross-stack sst.Linkable references"). If these ever drift,
 * the Phase 5 work will resolve it — the API is the runtime source
 * of truth and the infra here just has to match the API's
 * RunTask args.
 */
const TIER_SIZING = {
  free: { cpu: "512", memory: "1024" }, // 0.5 vCPU / 1 GB
  premium: { cpu: "1024", memory: "2048" }, // 1 vCPU / 2 GB
  enterprise: { cpu: "2048", memory: "4096" }, // 2 vCPU / 4 GB
} as const;

type Tier = keyof typeof TIER_SIZING;
const TIERS: readonly Tier[] = ["free", "premium", "enterprise"] as const;

/** Volume name referenced from both `volumes` and `mountPoints`. */
const EFS_VOLUME_NAME = "openclaw-workspace";

/**
 * CloudWatch Logs group for the task's container output. Single
 * group across tiers (each task gets a unique `awslogs-stream-prefix`
 * containing its task ID). 7-day retention per spec §14.5.3 —
 * unbounded retention is a real cost grow with per-session
 * OpenClaw debug output.
 */
const logGroup = new aws.cloudwatch.LogGroup("openclaw-task-logs", {
  name: `/aws/ecs/openclaw-${$app.stage}`,
  retentionInDays: 7,
});

/**
 * Build a tier-specific task definition. Returns the ARN so the
 * caller can collect them into a record keyed by tier.
 *
 * The image URI uses the `:bootstrap` tag for Phase 2; Phase 4's
 * deploy workflow updates the task definition to point at the
 * per-commit image (`${OPENCLAW_VERSION}-${GITHUB_SHA::7}`). Until
 * Phase 4 lands, the operator pushes `:bootstrap` to ECR manually
 * — see `apps/openclaw/README.md` for the recipe.
 */
function makeTaskDefinition(tier: Tier): aws.ecs.TaskDefinition {
  const { cpu, memory } = TIER_SIZING[tier];

  return new aws.ecs.TaskDefinition(`openclaw-task-def-${tier}`, {
    family: `openclaw-${$app.stage}-${tier}`,
    cpu,
    memory,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    taskRoleArn: taskRole.arn,
    executionRoleArn: executionRole.arn,
    runtimePlatform: {
      operatingSystemFamily: "LINUX",
      cpuArchitecture: "X86_64",
    },
    volumes: [
      {
        name: EFS_VOLUME_NAME,
        efsVolumeConfiguration: {
          fileSystemId: fileSystem.id,
          // No access-point ID hard-coded here — that's per-user and
          // gets supplied at RunTask time via the
          // `overrides.containerOverrides` block (Phase 5). The
          // task definition just declares the volume's existence.
          transitEncryption: "ENABLED",
        },
      },
    ],
    containerDefinitions: $util
      .all([repository.repositoryUrl, logGroup.name])
      .apply(([repoUrl, logGroupName]) =>
        JSON.stringify([
          {
            name: "openclaw",
            // `:bootstrap` placeholder per spec exit criterion. Phase 4
            // overwrites this via task-def revision on every deploy.
            image: `${repoUrl}:bootstrap`,
            essential: true,
            portMappings: [
              {
                containerPort: 18789,
                protocol: "tcp",
                appProtocol: "http",
              },
            ],
            mountPoints: [
              {
                sourceVolume: EFS_VOLUME_NAME,
                containerPath: "/data/workspace",
                readOnly: false,
              },
            ],
            // Environment is intentionally empty here — `AXEL_USER_ID`,
            // `AXEL_SESSION_ID`, `AXEL_TIER`, `OPENCLAW_GATEWAY_TOKEN`
            // are supplied as RunTask container overrides per session
            // in Phase 5, not baked into the definition.
            environment: [],
            logConfiguration: {
              logDriver: "awslogs",
              options: {
                "awslogs-group": logGroupName,
                "awslogs-region": "eu-west-2",
                "awslogs-stream-prefix": `openclaw-${tier}`,
              },
            },
            healthCheck: {
              // TCP probe via /dev/tcp — matches the Dockerfile's
              // healthcheck shape (no extra deps required). Once
              // OpenClaw upstream exposes a verified `/health` HTTP
              // endpoint, tighten this to a curl probe.
              command: [
                "CMD-SHELL",
                "bash -c '(echo > /dev/tcp/127.0.0.1/18789) >/dev/null 2>&1' || exit 1",
              ],
              interval: 30,
              timeout: 5,
              retries: 3,
              startPeriod: 90,
            },
          },
        ]),
      ),
  });
}

const definitions = Object.fromEntries(
  TIERS.map((tier) => [tier, makeTaskDefinition(tier)]),
) as Record<Tier, aws.ecs.TaskDefinition>;

/**
 * Exported as a record so the cross-stack SSM contract can stash all
 * three ARNs in a single parameter. The core API reads the JSON in
 * Phase 5 and picks the right one based on the authenticated user's
 * tier.
 */
export const taskDefinitionArns: Record<Tier, $util.Output<string>> = {
  free: definitions.free.arn,
  premium: definitions.premium.arn,
  enterprise: definitions.enterprise.arn,
};
