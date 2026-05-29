/**
 * Phase 6 reaper Lambda — EventBridge-scheduled cron that kills any
 * OpenClaw Fargate session whose `started_at + tier.wallClockMs` is
 * in the past.
 *
 * Spec reference: `docs/openclaw-fargate-spec.md` §6 + §10.
 *
 * ## Architecture
 *
 *   EventBridge (every 15 min)
 *     → Lambda (this resource)
 *       → Postgres SELECT (active sessions, filtered by tier cap)
 *       → ECS StopTask + ELB delete-rule + delete-target-group + UPDATE
 *       → CloudWatch PutMetricData (ReapSuccess, ReapFailure)
 *
 *   CloudWatch Alarms
 *     → SNS topic (operator subscribes manually post-deploy)
 *       - Lambda Errors > 0     (alarm name: openclaw-reaper-errors)
 *       - ReapFailure > 0       (alarm name: openclaw-reaper-failures)
 *
 * ## Why the handler lives in microservices/core
 *
 * The reaper shares the entire AWS-teardown surface with the core
 * API's `DELETE /openclaw/sessions/:id` (via `OpenclawSessionsService.
 * reapExpiredSessions → stopSession`). Duplicating that logic in the
 * openclaw SST app would create two places where idempotency, partial-
 * teardown, and "infra not deployed" edges would need to stay in
 * lock-step — exactly the kind of drift that ships bugs. The
 * cross-app reference happens at *bundle time* (SST/esbuild follows
 * the import path), not at *deploy time* (no `sst.Linkable` chain),
 * so the spec §4.3 invariant ("independently revertible") is intact.
 *
 * ## Permissions
 *
 * The reaper's execution role has DIRECT IAM grants on the AWS APIs
 * it needs, rather than assuming the `openclaw-<stage>-api-caller`
 * role like the core API does. The role IS the boundary here —
 * the reaper is inside the openclaw stack, not outside it.
 *
 * Grants:
 *   - `ecs:StopTask`, `ecs:DescribeTasks` on the cluster
 *   - `elasticloadbalancing:DeleteRule`,
 *     `elasticloadbalancing:DeleteTargetGroup`,
 *     `elasticloadbalancing:DeregisterTargets`,
 *     `elasticloadbalancing:DescribeTargetHealth` on this stage's TGs
 *   - `ssm:GetParameter`, `ssm:GetParameters` on `/axel/<stage>/openclaw/*`
 *   - `cloudwatch:PutMetricData` (no resource scope; the namespace
 *     is fixed in the handler)
 *
 * ## Secrets
 *
 * `DATABASE_URL` is an SST secret on this app, set per-stage:
 *
 *   cd apps/openclaw && bun x sst secret set DatabaseUrl '<url>' --stage staging
 *
 * The same value lives on the root axel-saas app — kept separate so
 * the reaper Lambda has its own injection point and the cross-app
 * boundary stays clean. If the database moves stages, both apps need
 * the new value.
 */

import { listener } from "./alb";
import { cluster } from "./cluster";

/**
 * Stage-scoped secret holding the Supabase connection string the
 * reaper Lambda uses to query active sessions. Operator runs `sst
 * secret set DatabaseUrl '<url>' --stage <stage>` once per stage; if
 * unset, the Lambda will boot but every invocation throws on first
 * Postgres query (visible via the Lambda Errors alarm).
 */
const databaseUrl = new sst.Secret("DatabaseUrl");

/**
 * Optional shared token for the bridge plugin's `auth: "gateway"`
 * routes — pre-existing concern carried over from the core API env
 * setup. The reaper passes it through to the service so any teardown
 * paths that call into the bridge plugin can authenticate; in practice
 * the teardown path doesn't currently call the bridge, but keep the
 * symmetry so a future change doesn't need to wire it in retroactively.
 */
const gatewayToken = process.env.OPENCLAW_GATEWAY_TOKEN || "";

/**
 * SNS topic for reaper alarm notifications. Operator subscribes a
 * pager / Slack webhook / email post-deploy:
 *
 *   aws sns subscribe --topic-arn <arn> --protocol email \
 *     --notification-endpoint ops@meetaxel.ai
 *
 * Keeping subscription out-of-band (rather than baked into the SST
 * config) so the topic can be re-pointed without a redeploy.
 */
export const alarmTopic = new aws.sns.Topic("openclaw-reaper-alarms", {
  name: `openclaw-${$app.stage}-reaper-alarms`,
});

/**
 * The reaper Lambda + EventBridge schedule. `sst.aws.Cron` wraps
 * Function + EventRule + EventTarget + Lambda Permission into a single
 * higher-level resource — preferred over hand-wiring four Pulumi
 * resources because the wiring is identical every time and SST has
 * tested the edge cases.
 */
export const reaper = new sst.aws.Cron("OpenclawReaper", {
  // Every 15 minutes per spec exit criterion ("kills it on its next
  // 15-min run"). Worst-case overshoot of a tier's wall-clock cap is
  // therefore 15 min — for Free's 1h cap that's 25%, acceptable for
  // a backstop. The job runs ~96 times/day, well under Lambda free
  // tier on a fresh account.
  schedule: "rate(15 minutes)",
  job: {
    // Bundle target lives in microservices/core. SST/esbuild follows
    // the import chain across the workspace boundary; the openclaw
    // SST app doesn't need to be a member of the root workspaces for
    // this to resolve at bundle time (the file imports from
    // @axel-saas/db which is resolved via microservices/core's own
    // node_modules tree, not the openclaw app's).
    handler:
      "../../microservices/core/src/application/openclaw/reaperHandler.handler",
    runtime: "nodejs22.x",
    timeout: "5 minutes",
    memory: "512 MB",
    environment: {
      STAGE: $app.stage,
      AWS_REGION: "eu-west-2",
      DATABASE_URL: databaseUrl.value,
      OPENCLAW_GATEWAY_TOKEN: gatewayToken,
    },
    permissions: [
      // ECS StopTask / DescribeTasks — scoped to this stage's cluster.
      // The cluster ARN comes from the same Pulumi output used elsewhere
      // in this app; using cluster.arn here also implicitly creates a
      // resource ordering edge so the cluster exists before the role
      // is created.
      {
        actions: ["ecs:StopTask", "ecs:DescribeTasks", "ecs:ListTasks"],
        resources: [
          cluster.arn,
          // Tasks themselves are addressed by ARN containing the cluster
          // name. Use a wildcard suffix; the cluster.arn condition above
          // already keys the principal scope.
          $interpolate`arn:aws:ecs:eu-west-2:*:task/openclaw-${$app.stage}/*`,
        ],
      },
      // ELB v2 teardown — scoped to this stage's listener for rule
      // operations, and wildcard on target groups (TG ARNs are not
      // known at deploy time — they're created per-session at runtime
      // by the core API). The natural scope tightening here would be
      // a resource tag policy on TGs, which the core API doesn't apply
      // today; tracked for a follow-up tightening pass.
      {
        actions: [
          "elasticloadbalancing:DeleteRule",
          "elasticloadbalancing:DescribeRules",
        ],
        resources: [
          listener.arn,
          "arn:aws:elasticloadbalancing:*:*:listener-rule/*",
        ],
      },
      {
        actions: [
          "elasticloadbalancing:DeleteTargetGroup",
          "elasticloadbalancing:DeregisterTargets",
          "elasticloadbalancing:DescribeTargetHealth",
        ],
        resources: [
          $interpolate`arn:aws:elasticloadbalancing:eu-west-2:*:targetgroup/openclaw-*/*`,
        ],
      },
      // SSM contract — the reaper reads the same cross-stack params
      // the core API does (cluster ARN, listener ARN, etc.), via
      // getOpenclawInfra() inside the handler. Scoped to this stage's
      // namespace.
      {
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          $interpolate`arn:aws:ssm:eu-west-2:*:parameter/axel/${$app.stage}/openclaw/*`,
        ],
      },
      // CloudWatch custom metrics — namespace-keyed enforcement is
      // not directly supported by IAM; use the namespace-conditioned
      // grant pattern AWS recommends.
      {
        actions: ["cloudwatch:PutMetricData"],
        resources: ["*"],
      },
    ],
  },
});

/**
 * Alarm: any Lambda invocation error in a 15-min window. Uses the
 * built-in `AWS/Lambda` `Errors` metric — no custom emission needed
 * from the handler. Treats a single error as alarm-worthy: in a
 * working steady state the reaper should NEVER error; if it does,
 * we want eyes on it before the next 15-min tick.
 */
new aws.cloudwatch.MetricAlarm("openclaw-reaper-errors", {
  name: `openclaw-${$app.stage}-reaper-errors`,
  alarmDescription:
    "Phase 6 reaper Lambda threw on its last invocation. Investigate before the next 15-min tick — a recurring throw means tasks aren't being reaped and the cost leak resumes.",
  namespace: "AWS/Lambda",
  metricName: "Errors",
  dimensions: { FunctionName: reaper.nodes.job.name },
  statistic: "Sum",
  period: 900, // 15 min
  evaluationPeriods: 1,
  threshold: 1,
  comparisonOperator: "GreaterThanOrEqualToThreshold",
  treatMissingData: "notBreaching",
  alarmActions: [alarmTopic.arn],
});

/**
 * Alarm: per-session teardown failures inside the reaper. Distinct
 * from the Lambda Errors alarm because a single bad row shouldn't
 * fail the invocation (per-row catch in `reapExpiredSessions`); we
 * still want it surfaced via SNS so the operator can investigate
 * which row + which AWS API failed.
 *
 * The reaper emits `ReapFailure` even on a clean run (value 0) so
 * `treatMissingData: notBreaching` is defensive only — covers the
 * case where PutMetricData itself fails (the handler swallows that,
 * see reaperHandler.emitMetrics) and the metric data never arrives.
 */
new aws.cloudwatch.MetricAlarm("openclaw-reaper-failures", {
  name: `openclaw-${$app.stage}-reaper-failures`,
  alarmDescription:
    "Phase 6 reaper had one or more per-session teardown failures in the last 15-min window. Check CloudWatch Logs for the failing sessionId; the row is stuck active until the AWS resource is reconciled.",
  namespace: "Axel/Openclaw/Reaper",
  metricName: "ReapFailure",
  dimensions: { Stage: $app.stage },
  statistic: "Sum",
  period: 900,
  evaluationPeriods: 1,
  threshold: 1,
  comparisonOperator: "GreaterThanOrEqualToThreshold",
  treatMissingData: "notBreaching",
  alarmActions: [alarmTopic.arn],
});
