# `@axel-saas/openclaw-infra` — SST app (Phases 2 + 3 + 6)

Provisions the long-lived AWS resources the OpenClaw Fargate runtime
needs: ECR, ECS cluster, EFS, IAM roles, ALB with the wildcard ACM
cert + HTTPS-443 listener, Route53 wildcard ALIAS, task definitions
for all three tiers, SSM parameter writes for the cross-stack
contract, and the Phase 6 reaper Lambda + alarms.

This is a **separate, independent SST v3 app** from the root
`axel-saas` SST config at the repo root. Same AWS accounts, same
stages, but no cross-stack `sst.Linkable` references. The boundary
is intentional per `docs/openclaw-fargate-spec.md` §1 — the core
API reads everything it needs from SSM Parameter Store (`/axel/<stage>/openclaw/*`).

## What's in scope (Phases 2 + 3)

- ECR repo (`openclaw-<stage>`) with image scanning + 30-image retention.
- ECS cluster (`openclaw-<stage>`) with Fargate + Fargate Spot capacity providers.
- EFS file system with mount targets in all default-VPC subnets and 30-day IA transition.
- Three IAM roles: task role (empty for now), execution role (ECR pull + logs), API caller role (assumed by the core API Lambda in Phase 5).
- Three security groups: ALB SG (443 from the world), task SG (18789 from ALB only, full egress), EFS SG (2049 from task SG only).
- **Phase 3 additions:** ACM wildcard cert for `*.openclaw.<zone>`, DNS-validated via Route53. Route53 wildcard ALIAS `*.openclaw.<zone>` → ALB. ALB listener swapped from HTTP-80 → HTTPS-443 with that cert + `ELBSecurityPolicy-TLS13-1-2-2021-06` (TLS 1.2+).
- Three task definitions (Free / Premium / Enterprise) with per-tier (vCPU, memory). Image URI is `<ecr-repo>:bootstrap` — see [Bootstrap image](#bootstrap-image-one-time-operator-step) below.
- SSM parameters under `/axel/<stage>/openclaw/*` for the cross-stack contract (Phase 3 adds `hosted-zone-id`).

### Dev stages

Dev / preview stages (anything that isn't `staging` or `production`) have no hosted zone available. The DNS module no-ops on those: no cert, no Route53 record, no `hosted-zone-id` SSM param. **Both the ALB listener AND the ALB SG ingress** fall back to HTTP-80 in lock-step (the SG ingress rule's port branches on the same `certificateArn !== null` check as the listener, both in `alb.ts`) so smoke tests work via the raw ALB DNS name — matches spec §9.1 ("ALB DNS direct").

## Phase 6 — Reaper Lambda + alarms

Provisioned in `infra/reaper.ts`. EventBridge fires the reaper Lambda every 15 minutes; the handler queries Postgres for sessions whose `started_at + tier.wallClockMs` is in the past and tears each down via the same `OpenclawSessionsService.stopSession` path the core API's `DELETE /openclaw/sessions/:id` uses (the handler module lives at `microservices/core/src/application/openclaw/reaperHandler.ts` — SST/esbuild follows the import chain across the workspace boundary at bundle time; no deploy-time linking, the spec §4.3 invariant is intact).

Wall-clock caps per tier (from `tierPolicy.ts` — single source of truth):

| Tier       | Wall-clock cap |
| ---------- | -------------- |
| Free       | 1 h            |
| Premium    | 8 h            |
| Enterprise | 24 h           |

### Per-stage secret

The reaper needs DB access; set the connection string once per stage:

```bash
cd apps/openclaw
bun x sst secret set DatabaseUrl 'postgres://…' --stage staging
bun x sst secret set DatabaseUrl 'postgres://…' --stage production
```

The same value lives on the root axel-saas app — they're stored independently so the cross-app boundary stays clean (no `sst.Linkable` chain).

### Alarms + SNS

Two CloudWatch alarms wired to a per-stage SNS topic (`openclaw-<stage>-reaper-alarms`):

- `openclaw-<stage>-reaper-errors` — Lambda invocation errors > 0 over 15 min (built-in `AWS/Lambda` `Errors` metric).
- `openclaw-<stage>-reaper-failures` — per-session teardown failures > 0 over 15 min (custom `Axel/Openclaw/Reaper/ReapFailure` metric emitted by the handler).

The SNS topic ARN is in the SST output as `reaperAlarmTopicArn`. Subscribe a pager / email / Slack webhook post-deploy:

```bash
TOPIC_ARN=$(bun x sst output reaperAlarmTopicArn --stage staging)
aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email \
  --notification-endpoint ops@meetaxel.ai
```

The subscription is intentionally out-of-band — re-point without a redeploy.

### Manual reaper exit-criterion test

Per spec §1.4: forcing a Free task's `started_at` back 65 minutes should result in the reaper killing it on its next 15-min run.

```bash
# 1. Create a Free session via the core API.
# 2. Force its started_at back via direct DB update:
psql "$DATABASE_URL" -c "
  UPDATE openclaw_sessions
  SET started_at = now() - interval '65 minutes'
  WHERE id = '<session-id>';
"
# 3. Wait up to 15 min for the next EventBridge tick.
# 4. Confirm the row is now stopped_at IS NOT NULL with stopped_reason='reaper'.
```

## Operator scripts (`scripts/`)

Three runbooks live under `apps/openclaw/scripts/`. Run from anywhere — they resolve paths relative to their own location.

| Script                    | When                                                                                 | What                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `push-bootstrap-image.sh` | Once per stage, before first POST /openclaw/sessions                                 | Builds + pushes the `:bootstrap` image referenced by the task definitions. Until this runs, RunTask can't pull an image and session creation hangs/500s. Production-gated behind a `read -p` confirm.                                                                                                       |
| `smoke-test-sessions.sh`  | After every deploy that touches Phase 4/5                                            | Verifies the session lifecycle: POST `/openclaw/sessions` → poll `/healthz` until 200 → GET listed → DELETE 204. Trap auto-cleans on early failure.                                                                                                                                                         |
| `verify-chat-loop.sh`     | Once per stage post-merge, then after any bridge-plugin or workspace-template change | Closes the end-to-end loop: POST session → poll → POST `/api/chat` to the bridge plugin → assert non-empty `response` → DELETE. Proves the bridge plugin's `/api/chat` translates to OpenClaw's `/v1/chat/completions` against a real Fargate task (the pre-Phase-5 smoke tests only covered local docker). |

Each script's header comment documents required + optional env vars and distinct exit codes per failure mode (so a CI wrapper can branch on outcome). Always require `STAGE` and a `JWT`; `verify-chat-loop.sh` also requires `OPENCLAW_GATEWAY_TOKEN` + `USER_ID`.

## What's NOT in scope (deferred to later work)

- "Active tasks > 90" alarm (ALB rule cap precursor) — requires a custom metric the reaper would emit on every run; deferred to a follow-up alongside any other operational metrics.
- "Tasks running > 6h" alarm (precursor to wall-clock kill) — same shape, deferred.
- Tag-based scoping of the reaper's ELB v2 permissions (target groups currently match `targetgroup/oc-*/*` — the prefix the core API uses, capped at 32 chars by AWS; tightening requires the core API to apply a resource tag at creation time).

## Deploy

This app is **not** a member of the root workspaces (`packages/*`, `microservices/*` only). It has its own `package.json` + `bun.lock` + `node_modules`. On a clean clone, install + bootstrap SST's platform types before deploying or typechecking:

```bash
cd apps/openclaw
bun install              # installs sst, @tsconfig/node22, @types/node, typescript
bun x sst install        # generates .sst/platform/config.d.ts (provides the
                         # ambient `aws`, `$app`, `$util`, `$config` globals)
```

After that, the normal SST workflow:

```bash
# Diff first (read-only) to inspect resource plan
bun x sst diff --stage staging

# Deploy
bun x sst deploy --stage staging
```

The default VPC must exist in the target account + region (`eu-west-2`).
Some AWS accounts created after 2022 don't have one — if that's the
case the deploy fails fast with a clear message. The remediation is
`aws ec2 create-default-vpc` against the target account.

## Bootstrap image (one-time operator step)

The task definitions reference `${ECR_REPO_URI}:bootstrap`. Until
Phase 4's deploy workflow takes over per-commit image pushes, the
operator pushes the bootstrap image by hand to validate the pipeline:

```bash
# 1. Resolve the ECR URI directly. Phase 2 doesn't publish this to
#    SSM because the core API doesn't need it (only the deploy
#    workflow does, which lands in Phase 4).
STAGE=staging
ECR_URI=$(aws ecr describe-repositories \
  --repository-names openclaw-${STAGE} \
  --query 'repositories[0].repositoryUri' --output text)

# 2. Login to ECR.
aws ecr get-login-password --region eu-west-2 \
  | docker login --username AWS --password-stdin "${ECR_URI%/*}"

# 3. Build the OpenClaw image. From `apps/openclaw/`:
cd ../../docker/openclaw
OPENCLAW_VERSION=$(jq -r .openclaw versions.json)
docker build --platform linux/amd64 \
  --build-arg OPENCLAW_VERSION="${OPENCLAW_VERSION}" \
  -t openclaw:bootstrap \
  -f Dockerfile ../.. # build context is repo root — Dockerfile COPYs both docker/openclaw/ AND packages/openclaw-bridge-plugin/ so it needs the full tree

# 4. Tag + push as `:bootstrap`.
docker tag openclaw:bootstrap "${ECR_URI}:bootstrap"
docker push "${ECR_URI}:bootstrap"
```

Phase 4 replaces this with a workflow-dispatched build per the
`openclaw-deploy.yml` design in the spec.

## Verification

### Phase 2 exit criteria

```bash
# (1) Deploy succeeds end-to-end.
cd apps/openclaw && bun x sst deploy --stage staging

# (2) ALB DNS returns 404 (confirms listener works).
ALB_DNS=$(aws ssm get-parameter \
  --name /axel/staging/openclaw/alb-dns-name \
  --query Parameter.Value --output text)
# Pre-Phase 3 deploys use HTTP; staging + production are HTTPS post-Phase 3.
curl -ki "http://${ALB_DNS}/" || curl -ki "https://${ALB_DNS}/"
# Expected: HTTP/1.1 404 Not Found  →  body "Not Found"

# (3) Cross-stack contract is populated.
aws ssm get-parameter --name /axel/staging/openclaw/cluster-arn
# Expected: a valid ARN

aws ssm get-parameters-by-path \
  --path /axel/staging/openclaw \
  --query 'Parameters[].Name' --output table
# Expected (Phase 2): cluster-arn, task-definition-arns, subnet-ids,
#                     task-security-group-id, efs-file-system-id,
#                     alb-listener-arn, alb-dns-name, api-caller-role-arn
# Expected (Phase 3, additionally): hosted-zone-id

# (4) No new VPC was created.
aws cloudformation describe-stack-resources \
  --stack-name <stack-name-from-sst-output> \
  --query 'StackResources[?ResourceType==`AWS::EC2::VPC`]'
# Expected: empty

# (5) `sst remove` tears everything down cleanly.
bun x sst remove --stage staging
```

### Phase 3 exit criteria

Phase 3 adds DNS + TLS + the manual-session smoke test. The infra
checks first:

```bash
# (1) Wildcard ACM cert is issued + validated.
aws acm list-certificates --region eu-west-2 \
  --query "CertificateSummaryList[?DomainName=='*.openclaw.staging.meetaxel.ai'].Status"
# Expected: ["ISSUED"]

# (2) Listener is HTTPS-443 with the cert attached.
LISTENER_ARN=$(aws ssm get-parameter \
  --name /axel/staging/openclaw/alb-listener-arn \
  --query Parameter.Value --output text)
aws elbv2 describe-listeners --listener-arns "${LISTENER_ARN}" \
  --query 'Listeners[0].{Port:Port,Protocol:Protocol,SslPolicy:SslPolicy}'
# Expected: { "Port": 443, "Protocol": "HTTPS", "SslPolicy": "ELBSecurityPolicy-TLS13-1-2-2021-06" }

# (3) Wildcard ALIAS record resolves to the ALB.
dig +short test.openclaw.staging.meetaxel.ai
# Expected: a CNAME chain ending at an *.elb.amazonaws.com IP

# (4) TLS handshake succeeds at any subdomain.
curl -i https://test.openclaw.staging.meetaxel.ai/
# Expected: HTTP/1.1 404 Not Found  (default listener action — there's
# no session running on `test` yet, see the manual recipe below)
```

The "URL serves OpenClaw end-to-end" criterion needs a manually-launched task; see the next section.

## Phase 3 manual session smoke test

Until Phase 5 wires up `POST /openclaw/sessions` in the core API, the only way to prove `https://<name>.openclaw.<zone>` serves a real OpenClaw runtime is to do it by hand. This recipe brings up one task, registers it under `test.openclaw.staging.meetaxel.ai`, and tears it back down. **Run from `apps/openclaw/`** unless noted.

```bash
# ── 0. Prerequisite: bootstrap image must be in ECR ────────────────
# See "Bootstrap image" above. Confirm:
ECR_URI=$(aws ecr describe-repositories \
  --repository-names openclaw-staging \
  --query 'repositories[0].repositoryUri' --output text)
aws ecr describe-images --repository-name openclaw-staging \
  --image-ids imageTag=bootstrap >/dev/null && echo "image present"

# ── 1. Gather the SSM-published infra IDs ──────────────────────────
STAGE=staging
TARGET_GROUP_NAME="openclaw-${STAGE}-smoke"     # any unique name, ≤ 32 chars
SESSION_SUBDOMAIN="test.openclaw.staging.meetaxel.ai"
VPC_ID=$(aws ec2 describe-vpcs --filters 'Name=is-default,Values=true' \
  --query 'Vpcs[0].VpcId' --output text)
SUBNETS=$(aws ssm get-parameter \
  --name /axel/${STAGE}/openclaw/subnet-ids \
  --query Parameter.Value --output text)
TASK_SG=$(aws ssm get-parameter \
  --name /axel/${STAGE}/openclaw/task-security-group-id \
  --query Parameter.Value --output text)
CLUSTER_ARN=$(aws ssm get-parameter \
  --name /axel/${STAGE}/openclaw/cluster-arn \
  --query Parameter.Value --output text)
TASK_DEF_ARN=$(aws ssm get-parameter \
  --name /axel/${STAGE}/openclaw/task-definition-arns \
  --query Parameter.Value --output text | jq -r .premium)
LISTENER_ARN=$(aws ssm get-parameter \
  --name /axel/${STAGE}/openclaw/alb-listener-arn \
  --query Parameter.Value --output text)
EFS_ID=$(aws ssm get-parameter \
  --name /axel/${STAGE}/openclaw/efs-file-system-id \
  --query Parameter.Value --output text)

# ── 2. Run the task ────────────────────────────────────────────────
# `--enable-execute-command true` is optional but useful for shell-in
# debugging while we're still bringing this up. `assignPublicIp ENABLED`
# is required because tasks need ECR pull + outbound LLM traffic and
# there's no NAT gateway (spec §13.3 + §9.2).
TASK_ARN=$(aws ecs run-task \
  --cluster "${CLUSTER_ARN}" \
  --task-definition "${TASK_DEF_ARN}" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[${TASK_SG}],assignPublicIp=ENABLED}" \
  --overrides '{
    "containerOverrides": [{
      "name": "openclaw",
      "environment": [
        {"name": "AXEL_USER_ID",    "value": "smoke-test"},
        {"name": "AXEL_SESSION_ID", "value": "smoke-test-1"},
        {"name": "AXEL_TIER",       "value": "premium"},
        {"name": "OPENCLAW_GATEWAY_TOKEN", "value": "smoke-test-token-do-not-leak"}
      ]
    }]
  }' \
  --query 'tasks[0].taskArn' --output text)
echo "Started task: ${TASK_ARN}"

# Wait for the ENI to attach + the task to start.
aws ecs wait tasks-running --cluster "${CLUSTER_ARN}" --tasks "${TASK_ARN}"

# ── 3. Find the task's private IP ──────────────────────────────────
ENI_ID=$(aws ecs describe-tasks \
  --cluster "${CLUSTER_ARN}" --tasks "${TASK_ARN}" \
  --query 'tasks[0].attachments[0].details[?name==`networkInterfaceId`].value' \
  --output text)
TASK_IP=$(aws ec2 describe-network-interfaces \
  --network-interface-ids "${ENI_ID}" \
  --query 'NetworkInterfaces[0].PrivateIpAddress' --output text)
echo "Task IP: ${TASK_IP}"

# ── 4. Create + register the target group ──────────────────────────
TG_ARN=$(aws elbv2 create-target-group \
  --name "${TARGET_GROUP_NAME}" \
  --protocol HTTP \
  --port 18789 \
  --vpc-id "${VPC_ID}" \
  --target-type ip \
  --health-check-protocol HTTP \
  --health-check-path "/" \
  --health-check-interval-seconds 15 \
  --healthy-threshold-count 2 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

aws elbv2 register-targets \
  --target-group-arn "${TG_ARN}" \
  --targets "Id=${TASK_IP},Port=18789"

# ── 5. Listener rule: route the subdomain to the target group ─────
aws elbv2 create-rule \
  --listener-arn "${LISTENER_ARN}" \
  --priority 100 \
  --conditions "Field=host-header,Values=${SESSION_SUBDOMAIN}" \
  --actions "Type=forward,TargetGroupArn=${TG_ARN}"

# ── 6. Wait for the target to become healthy + smoke-test ─────────
aws elbv2 wait target-in-service --target-group-arn "${TG_ARN}"
curl -i "https://${SESSION_SUBDOMAIN}/"
# Expected: 200 with OpenClaw's Control-UI SPA, OR whatever the
# bridge plugin's `/` returns. A non-404 response confirms the
# route is working end-to-end.

# ── 7. Teardown (always do this — Free tier wall-clock is 1h, Premium 8h) ─
RULE_ARN=$(aws elbv2 describe-rules --listener-arn "${LISTENER_ARN}" \
  --query "Rules[?Conditions[?Field=='host-header' && Values[0]=='${SESSION_SUBDOMAIN}']].RuleArn" \
  --output text)
aws elbv2 delete-rule --rule-arn "${RULE_ARN}"
aws elbv2 deregister-targets \
  --target-group-arn "${TG_ARN}" \
  --targets "Id=${TASK_IP},Port=18789"
aws elbv2 delete-target-group --target-group-arn "${TG_ARN}"
aws ecs stop-task --cluster "${CLUSTER_ARN}" --task "${TASK_ARN}" \
  --reason "phase-3 smoke test complete"
```

### What this recipe approximates

Each numbered step in the recipe maps to one of the operations Phase 5's `POST /openclaw/sessions` will perform programmatically via the AWS SDK from the core API:

| Recipe step       | Phase 5 equivalent                                                           |
| ----------------- | ---------------------------------------------------------------------------- |
| 1 — gather IDs    | Read SSM on Lambda cold start                                                |
| 2 — `run-task`    | `ecs:RunTask` with per-user EFS access-point override + per-session env vars |
| 3 — get IP        | `ecs:DescribeTasks` (poll until ENI attached)                                |
| 4 — target group  | `elbv2:CreateTargetGroup` + `RegisterTargets`                                |
| 5 — listener rule | `elbv2:CreateRule` with host condition                                       |
| 6 — wait healthy  | `elbv2:DescribeTargetHealth` poll                                            |
| 7 — teardown      | `DELETE /openclaw/sessions/:id` runs steps 5→4→2 in reverse                  |

If anything in the recipe fails, the corresponding Phase 5 step has the same failure mode — worth treating that as a deliberate test.

## Repo layout (this app only)

```
apps/openclaw/
  sst.config.ts       # SST app entry; coordinates module imports
  package.json
  tsconfig.json
  README.md           # this file
  infra/
    ecr.ts            # ECR repo + lifecycle policy
    cluster.ts        # ECS cluster + default-VPC discovery
    iam.ts            # Task role + execution role + 3 security groups
    efs.ts            # File system + mount targets per AZ
    apiCaller.ts      # API caller role + scoped inline policy
    dns.ts            # Route53 zone lookup + ACM wildcard cert (Phase 3)
    alb.ts            # ALB + HTTPS-443 listener + wildcard ALIAS record
    taskDefinition.ts # 3 task definitions (one per tier)
    ssm.ts            # Cross-stack contract under /axel/<stage>/openclaw/*
```

The order of imports in `sst.config.ts` is significant — modules
that reference others must load after their dependencies. `dns.ts`
must load before `alb.ts` (the listener attaches the cert from
`dns.ts`); `apiCaller.ts` must load after `cluster.ts` + `efs.ts`
(its inline policy scopes by their ARNs).
