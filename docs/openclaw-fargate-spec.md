# OpenClaw on Fargate — Spec

Per-user, dockerised OpenClaw runtime on AWS ECS/Fargate, deployed by a GitHub Actions workflow that is itself dispatched via the GitHub REST API. Infrastructure-as-code is a **new, standalone SST v3 app** under `apps/openclaw/` — it does not extend the existing `sst.config.ts` and shares no stack outputs with the core API.

---

## Note (added 2026-05-04 post-#98 spike)

A spike against `openclaw@v2026.4.26` (carried out as part of PR #98 — typed gateway client) confirmed that the OpenClaw runtime does **not** expose our gateway-contract REST endpoints (`/api/chat`, `/api/health`, `/api/reload`, `/api/usage`) directly. Chat is WebSocket-based; the HTTP surface is `/healthz` plus the Control-UI SPA at `/`.

This generalises §7.1's existing call-out that "HTTP `/health` exposure is unverified upstream" to the whole gateway contract — closing the chat loop therefore requires a REST→WS sidecar in `docker/openclaw/` that translates our REST contract to OpenClaw's WS protocol. Tracked as the post-#98 next-big-PR (`feat/openclaw-sidecar-shim`).

The rest of this spec (Phases 2–6) is unaffected and remains the canonical infra plan.

---

## 1. Goals & Non-Goals

### Goals

1. Each authenticated user can run an isolated OpenClaw instance on Fargate.
2. Image version is **pinned to a specific GitHub release of OpenClaw** and stable over time. Bumps are explicit PRs.
3. Long-lived infrastructure (cluster, ALB, image, task definition, EFS, DNS zone, IAM) is provisioned by a GitHub Actions workflow that can be triggered by an API call (`workflow_dispatch` via the GitHub REST API).
4. Per-user lifecycle (start/stop a session, attach a subdomain, mount the user's EFS volume) is driven by the existing Elysia API calling the AWS SDK directly — **not** by GitHub Actions.
5. The new SST app is independent: same AWS accounts as `axel-saas` (preprod / production), separate SST app name, no cross-stack `sst.Linkable` references to the core stack.

### Non-Goals (this spec)

- Not changing the existing `sst.config.ts`, `infra/api.ts`, or `infra/web.ts`.
- Not building OpenClaw itself or modifying the OpenClaw codebase.
- Not implementing an idle reaper — explicit stop only (with a hard wall-clock backstop, see §10).
- Not implementing model routing, billing, or auth for the OpenClaw runtime — those live in the core API and are out of scope here.

---

## 1a. Phased Build Plan

Each phase is **a single PR (or two at most)**, branchable in isolation, mergeable to `main` independently, and revertible without losing the previous phase. No phase is allowed to start until the previous one is merged. Each phase has its own exit criteria — these are also the PR description's "verification" section.

### Phase 1 — Local Docker only (no AWS)

**Goal:** Run a pinned-version OpenClaw container on a laptop with `docker compose up`. No AWS account touched. This is the cheapest, fastest validation step and unblocks everything downstream.

**Scope:**

- Copy contents of `docker/user-container/` → `docker/openclaw/` (keep the original untouched).
- Add `docker/openclaw/versions.json` with the chosen pinned `openclaw` GitHub release tag.
- Rewrite `docker/openclaw/Dockerfile`:
  - `ARG OPENCLAW_VERSION` (no default `latest`)
  - `ARG OPENCLAW_REPO=openclaw/openclaw`
  - `RUN npm install -g github:${OPENCLAW_REPO}#${OPENCLAW_VERSION}` (no `@latest` anywhere)
  - `tini` as PID 1, TCP healthcheck on `:18789` (OpenClaw's gateway port; `/health` HTTP endpoint exposure is unverified upstream so we use a TCP probe)
  - `EXPOSE 18789`
- Update `docker/openclaw/docker-entrypoint.sh` to honour `OPENCLAW_WORKSPACE_PATH`, `AXEL_USER_ID`, `AXEL_SESSION_ID`, `AXEL_SESSION_NAME`, `AXEL_TIER`. Seed the workspace from templates only if empty.
- Add a `docker-compose.yml` next to the Dockerfile that:
  - Builds with `--build-arg OPENCLAW_VERSION=$(jq -r .openclaw versions.json)`
  - Mounts a named volume at `OPENCLAW_WORKSPACE_PATH` so state survives `docker compose down`
  - Exposes `18789` on the host

**Exit criteria:**

- `docker compose -f docker/openclaw/docker-compose.yml up` boots OpenClaw in < 30s with the pinned version.
- `nc -z localhost 18789` succeeds (gateway accepts TCP). HTTP `/health` is not assumed.
- Re-running the container preserves any files written into the workspace volume.
- `grep -r "@latest" docker/openclaw/` returns nothing.
- `docker/user-container/` is byte-for-byte unchanged (verified by `git diff --stat`).

### Phase 2 — SST app skeleton (no traffic, no public URL yet)

**Goal:** Provision the long-lived AWS resources needed to run a Fargate task: ECR, ECS cluster, EFS, IAM roles, ALB with default 404 listener. Deployable to preprod via `sst deploy` from the local CLI. No GitHub workflow yet, no DNS attached.

**Scope:**

- `apps/openclaw/sst.config.ts` (SST app name `openclaw`, region `eu-west-2`, default VPC).
- `apps/openclaw/infra/{ecr,efs,cluster,alb,iam,taskDefinition}.ts`. No `dns.ts` and no `reaper.ts` yet.
- Task definitions registered for all three tiers (Free / Premium / Enterprise) with placeholder image (`ECR_REPO_URI:bootstrap`).
- SSM parameters under `/axel/<stage>/openclaw/`\* written by the SST app at deploy time (cluster ARN, task definition ARNs, subnet IDs, security group ID, EFS file system ID, ALB listener ARN).
- Push a single `bootstrap` image to ECR by hand to validate the pipeline.

**Exit criteria:**

- `cd apps/openclaw && bun x sst deploy --stage preprod` succeeds end-to-end.
- ALB DNS name returns `404` for any HTTPS request (confirms listener works).
- `aws ssm get-parameter --name /axel/preprod/openclaw/cluster-arn` returns a valid ARN.
- CloudFormation diff shows **no new VPC** created.
- `sst remove --stage preprod` tears everything down cleanly.

### Phase 3 — DNS + first manual session (still no GitHub workflow)

**Goal:** Add wildcard DNS, push the real (non-bootstrap) Phase-1 image to ECR, manually run `aws ecs run-task` to bring up one OpenClaw task, register it under a subdomain, prove the URL serves OpenClaw.

**Scope:**

- `apps/openclaw/infra/dns.ts` — Route53 lookup, ACM cert, wildcard alias record.
- Document the manual `aws ecr push` + `aws ecs run-task` recipe in `apps/openclaw/README.md`.

**Exit criteria:**

- `https://test.openclaw.staging.meetaxel.ai` resolves to a running OpenClaw, healthcheck passes, page loads.
- DNS, cert, and listener rule can be torn down by deleting the listener rule and stopping the task.

### Phase 4 — GitHub workflow (`workflow_dispatch`)

**Goal:** Replace the manual recipe with a workflow dispatched via GitHub REST API. Workflow handles image build/push and `sst deploy`.

**Scope:**

- `.github/workflows/openclaw-deploy.yml` per §6.
- Concurrency lock per stage.
- Idempotent image push (skip if tag exists).
- Verifies the OpenClaw GitHub release tag exists before building.

**Exit criteria:**

- `gh api -X POST .../workflows/openclaw-deploy.yml/dispatches -f 'inputs[stage]=preprod'` triggers a successful deploy.
- Re-dispatching with the same inputs is a no-op for unchanged image tags.
- Failure modes (missing release tag, ECR push denied, SST deploy diff non-empty when not expected) all produce useful workflow output.

### Phase 5 — Core API endpoints (per-user RunTask)

**Goal:** `POST /openclaw/sessions` and `DELETE /openclaw/sessions/:id` go live in the existing core API. Per-user EFS access points are provisioned on demand.

**Scope:**

- `microservices/core/src/application/openclaw/{handler,service,repository,tierPolicy}.ts`.
- DB migration adding the sessions table per §7.3.
- Auth + tier gating + idempotency per §7.1.
- Stripe cancellation hook in the existing webhook handler tears down active sessions.
- Tests at ≥ 90% coverage per `CLAUDE.md`.

**Exit criteria:**

- A logged-in Premium user can call `POST /openclaw/sessions { name: "demo" }` and reach `https://demo.openclaw.staging.meetaxel.ai` within 60s.
- `DELETE /openclaw/sessions/<id>` makes the subdomain return 404 within 30s.
- Concurrency cap is enforced (3rd Premium session in parallel returns 429).
- `bun run test:unit` passes with new coverage ≥ 90%.

### Phase 6 — Reaper + alarms (cost & reliability backstops)

**Goal:** No task can ever run beyond its tier's wall-clock cap. CloudWatch alarms fire on the cost and capacity edges.

**Scope:**

- `apps/openclaw/infra/reaper.ts` + `apps/openclaw/src/reaper/handler.ts`.
- CloudWatch alarms per §10.
- Daily cost report subscription (existing Cost Explorer setup is fine).

**Exit criteria:**

- Manually setting a Free task's wall-clock to 65 minutes (forced) results in the reaper killing it on its next 15-min run.
- Alarms exist and are wired to SNS.
- A test "stuck task" alarm fires correctly in preprod.

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────────────┐
│  GitHub                                                                    │
│                                                                            │
│  REST API ──workflow_dispatch──▶  .github/workflows/openclaw-deploy.yml    │
│                                       │                                    │
│                                       ▼                                    │
│  Build OpenClaw image (pinned ver) ──▶ Push to ECR ──▶ sst deploy --stage  │
└────────────────────────────────────────────────────────────────────────────┘
                                                     │
                                                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│  AWS (axel-saas account, per stage: preprod / production)                  │
│  Default VPC, eu-west-2 — no NAT, no new subnets                           │
│                                                                            │
│  ECR (openclaw)         EFS (workspaces)         Route53 (*.openclaw.<z>)  │
│       │                       │                          │                 │
│       ▼                       ▼                          ▼                 │
│  ECS cluster (Fargate) ◀── per-user task (RunTask) ──▶ ALB (wildcard cert) │
│       ▲                                                    ▲               │
│       │                                                    │               │
│       └──────── AWS SDK: RunTask / StopTask ───────────────┘               │
└────────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │
                  ┌───────────────┴───────────────┐
                  │  Elysia core API (existing)   │
                  │  POST /openclaw/sessions      │
                  │  DELETE /openclaw/sessions/:id│
                  └───────────────────────────────┘
                                  ▲
                                  │
                          authenticated user
```

**Trigger model is hybrid (locked decision):**

| Concern                                                                         | Owner                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Build image, push to ECR, deploy SST stack (cluster, ALB, EFS, task definition) | GitHub Actions workflow, dispatched via GitHub REST API |
| Per-user session start: RunTask, register ALB target, create Route53 record     | Elysia core API, AWS SDK                                |
| Per-user session stop: StopTask, deregister target, delete Route53 record       | Elysia core API, AWS SDK                                |
| Hard backstop: kill tasks > 8h wall-clock                                       | Scheduled EventBridge → Lambda (in this SST app)        |

---

## 3. Repository Layout

```
apps/
  openclaw/
    sst.config.ts                # NEW SST app, name: "openclaw" (does not extend root sst.config.ts)
    infra/
      cluster.ts                 # ECS cluster + Fargate capacity (default VPC)
      alb.ts                     # ALB + wildcard cert + listener + default rule
      ecr.ts                     # ECR repository for the OpenClaw image
      efs.ts                     # EFS file system + base access point factory
      taskDefinition.ts          # Parameterised ECS task definition (one revision per tier)
      dns.ts                     # Route53 hosted zone lookup, wildcard record
      iam.ts                     # Task role, execution role, API caller role
      reaper.ts                  # EventBridge schedule → Lambda backstop
    src/
      reaper/handler.ts          # Hard wall-clock kill (per-tier cap)
    docker-compose.yml           # Local-only — Phase 1 entrypoint for laptop testing
    README.md
docker/
  openclaw/                      # COPY of docker/user-container/ contents — kept independently
    Dockerfile                   # ARG OPENCLAW_VERSION, no @latest
    docker-entrypoint.sh         # Env-driven workspace path
    workspace-templates/         # (copied from docker/user-container/, not moved)
    versions.json                # { "openclaw": "v<x.y.z>" } — single source of truth
  user-container/                # UNCHANGED — kept as-is, not deprecated
.github/
  workflows/
    openclaw-deploy.yml          # workflow_dispatch only, callable via API
docs/
  openclaw-fargate-spec.md       # this doc
```

The existing `docker/user-container/` is **left untouched**. `docker/openclaw/` is a fresh, independent copy so this work cannot break the existing user-container path.

---

## 4. SST App: `apps/openclaw/`

### 4.1 App definition

```ts
// apps/openclaw/sst.config.ts
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    const stage = input?.stage ?? "dev";
    return {
      name: "openclaw",
      removal: stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(stage),
      home: "aws",
      providers: {
        aws: {
          region: "eu-west-2",
          defaultTags: {
            tags: {
              App: "openclaw",
              Stage: stage,
            },
          },
        },
      },
    };
  },
  async run() {
    const ecr = await import("./infra/ecr");
    const efs = await import("./infra/efs");
    const cluster = await import("./infra/cluster");
    const alb = await import("./infra/alb");
    const dns = await import("./infra/dns");
    const taskDef = await import("./infra/taskDefinition");
    const iam = await import("./infra/iam");
    const reaper = await import("./infra/reaper");

    return {
      ecrRepositoryUri: ecr.repository.url,
      ecsClusterArn: cluster.cluster.arn,
      ecsTaskDefinitionArns: taskDef.taskDefinitionArns, // map of tier → ARN
      albDnsName: alb.loadBalancer.dnsName,
      albListenerArn: alb.listener.arn,
      efsFileSystemId: efs.fileSystem.id,
      hostedZoneId: dns.zoneId,
      apiCallerRoleArn: iam.apiCallerRole.arn,
    };
  },
});
```

The default VPC in the target account/region is used directly — no networking module, no NAT gateway, no new subnets. See §4.2.

### 4.2 Resources

| Resource              | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VPC**               | **None provisioned.** Use the AWS default VPC in `eu-west-2`. Tasks launch into the default public subnets with public IPs assigned, locked down by a security group (ingress only from the ALB SG). Saves ~$65/month NAT idle cost — see §14.                                                                                                                                                                                                 |
| **ECS cluster**       | `sst.aws.Cluster` (Fargate). One cluster per stage, named `openclaw-<stage>`.                                                                                                                                                                                                                                                                                                                                                                  |
| **ECR repository**    | `aws.ecr.Repository("openclaw")` with image scanning enabled. Lifecycle policy: keep last 30 images.                                                                                                                                                                                                                                                                                                                                           |
| **EFS file system**   | One file system per stage. Per-user **EFS access points** (POSIX UID/GID per user) created lazily by the API at session start; root path `/users/<userId>`. EFS mount targets sit in the same default subnets as the tasks.                                                                                                                                                                                                                    |
| **ALB**               | Internet-facing, in default public subnets. Wildcard ACM cert for the stage's OpenClaw zone (see §9). HTTPS-only listener. Default action: 404.                                                                                                                                                                                                                                                                                                |
| **Route53**           | The existing per-stage hosted zone is reused (production: `meetaxel.ai`; preprod: `staging.meetaxel.ai`). One wildcard `A` ALIAS record `*.openclaw.<zone>` → ALB.                                                                                                                                                                                                                                                                             |
| **Task definitions**  | One revision **per tier** (Free, Premium, Enterprise) with that tier's CPU/memory baked in — Fargate only accepts certain (vCPU, memory) pairs, so we pre-register valid ones rather than overriding per-task. All revisions share the same image URI, task role, execution role, and EFS volume; the per-user access point ID comes via task override.                                                                                        |
| **Task role**         | Permissions OpenClaw itself needs at runtime (S3 read for prompts, KMS decrypt, Secrets Manager read of per-tenant credentials — all least-privilege).                                                                                                                                                                                                                                                                                         |
| **Execution role**    | ECR pull, CloudWatch Logs write.                                                                                                                                                                                                                                                                                                                                                                                                               |
| **API caller role**   | Assumable by the core API's Lambda execution role. Grants: `ecs:RunTask`, `ecs:StopTask`, `ecs:DescribeTasks`, `iam:PassRole` (scoped to the two roles above), `elasticloadbalancing:RegisterTargets/DeregisterTargets/CreateTargetGroup/DeleteTargetGroup/CreateRule/DeleteRule/DescribeRules`, `route53:ChangeResourceRecordSets` (scoped to the hosted zone), `elasticfilesystem:CreateAccessPoint/DeleteAccessPoint/DescribeAccessPoints`. |
| **Reaper Lambda**     | Scheduled every 15 min by EventBridge. Lists running tasks in the cluster tagged `App=openclaw`; calls `StopTask` on any whose `startedAt` exceeds its tier's wall-clock cap (§7.5). Cost backstop, see §10.                                                                                                                                                                                                                                   |
| **CloudWatch alarms** | (a) Tasks running > 6h; (b) Active tasks count > 90 (ALB rule cap warning, see §11); (c) Reaper Lambda errors.                                                                                                                                                                                                                                                                                                                                 |

### 4.3 Cross-stack contract (no SST output coupling)

The core API needs to know, at runtime: cluster ARN, task definition ARN, subnets, security group, EFS file system ID, ALB listener ARN, hosted zone ID, and the API caller role ARN.

**Contract:** the deploy workflow writes these values to **AWS SSM Parameter Store** under `/axel/<stage>/openclaw/...` after a successful `sst deploy`. The core API reads them at boot. This avoids importing SST stack outputs across apps (per the refactor roadmap, Phase G).

| SSM key                                       | Source                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| `/axel/<stage>/openclaw/cluster-arn`          | `cluster.cluster.arn`                                |
| `/axel/<stage>/openclaw/task-definition-arns` | JSON: `{ free, premium, enterprise }` → ARN per tier |
| `/axel/<stage>/openclaw/subnet-ids`           | Default VPC public subnet IDs                        |
| `/axel/<stage>/openclaw/security-group-id`    | Task SG ID                                           |
| `/axel/<stage>/openclaw/efs-file-system-id`   | `efs.fileSystem.id`                                  |
| `/axel/<stage>/openclaw/alb-listener-arn`     | `alb.listener.arn`                                   |
| `/axel/<stage>/openclaw/hosted-zone-id`       | `dns.zoneId`                                         |
| `/axel/<stage>/openclaw/api-caller-role-arn`  | `iam.apiCallerRole.arn`                              |

The API caller role is assumed by the core API Lambda via STS — the core API's existing execution role only needs `sts:AssumeRole` on this single ARN, no IAM blast radius.

---

## 5. Image: `docker/openclaw/`

The contents of `docker/openclaw/` are **copied** (not moved) from `docker/user-container/`. The original directory is left in place and unchanged. From this point on, anything the OpenClaw-on-Fargate work needs to modify (Dockerfile, entrypoint, workspace templates, version pinning) is done in `docker/openclaw/` only.

### 5.1 Versioning

- One source of truth: `docker/openclaw/versions.json`:
  ```json
  { "openclaw": "v1.4.2" }
  ```
- The Dockerfile reads it via build arg, **never** uses `@latest`.
- A version bump is a one-line PR. CI verifies the referenced GitHub release exists before merging (see §8.2).

### 5.2 Dockerfile (target shape)

```dockerfile
FROM node:22-slim

ARG OPENCLAW_VERSION
ARG OPENCLAW_REPO=openclaw/openclaw

RUN test -n "$OPENCLAW_VERSION" || (echo "OPENCLAW_VERSION is required" && exit 1)

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

# Install OpenClaw from the pinned GitHub release tag (versioned deployment from GitHub).
# Note: no @latest, no floating refs.
RUN npm install -g "github:${OPENCLAW_REPO}#${OPENCLAW_VERSION}"

RUN mkdir -p /data/workspace /data/workspace-templates
COPY workspace-templates/ /data/workspace-templates/

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV OPENCLAW_WORKSPACE_PATH=/data/workspace
WORKDIR /data/workspace

EXPOSE 18789
# TCP probe via bash builtin /dev/tcp — no extra deps. If a future OpenClaw release exposes a
# verified HTTP /health endpoint, this can be tightened to `wget -qO- http://127.0.0.1:18789/health`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bash -c '(echo > /dev/tcp/127.0.0.1/18789) >/dev/null 2>&1' || exit 1

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]
CMD ["openclaw", "gateway", "run"]
```

### 5.3 Entrypoint contract

The container reads the following environment variables (set by ECS task overrides per session):

| Env                       | Purpose                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `AXEL_USER_ID`            | Stable user ID — used for log correlation and (optionally) workspace seeding.       |
| `AXEL_SESSION_ID`         | Unique per RunTask call. Used for the subdomain / target group naming.              |
| `AXEL_TIER`               | Subscription tier (`free`, `premium`, `enterprise`). Drives `openclaw.json` config. |
| `OPENCLAW_WORKSPACE_PATH` | Mount path for the user's EFS access point. Defaults to `/data/workspace`.          |

The entrypoint:

1. Seeds `OPENCLAW_WORKSPACE_PATH` from `/data/workspace-templates/` only if empty (so re-runs preserve user state on EFS).
2. Writes a tier-specific `openclaw.json`.
3. `exec`s `openclaw gateway run`.

---

## 6. GitHub Actions Workflow

### 6.1 File: `.github/workflows/openclaw-deploy.yml`

**Trigger:** `workflow_dispatch` only — invoked via GitHub REST API.

**Inputs:**

| Input              | Required | Description                                                                                         |
| ------------------ | -------- | --------------------------------------------------------------------------------------------------- |
| `stage`            | yes      | `preprod` or `production`.                                                                          |
| `openclaw_version` | no       | Override `versions.json` (e.g. for hotfix testing). Must match an existing OpenClaw GitHub release. |
| `dry_run`          | no       | If `true`, runs `sst diff` only, skips deploy and image push.                                       |

**Pipeline:**

1. Checkout repo.
2. Resolve version: input override → else `versions.json`. Verify the GitHub release tag exists in the OpenClaw repo (`gh release view`). Fail fast if not.
3. Configure AWS credentials via OIDC (`AWS_ROLE_ARN_PREPROD` or `AWS_ROLE_ARN_PRODUCTION`, reusing the existing trust setup documented in `docs/next-steps-deployments.md`).
4. Login to ECR.
5. Compute image tag: `${OPENCLAW_VERSION}-${GITHUB_SHA::7}`.
6. Build & push image (BuildKit, `--build-arg OPENCLAW_VERSION=...`). Skip push if image with same tag already exists in ECR (idempotency).
7. From `apps/openclaw/`, run `bun install && bun x sst deploy --stage <stage>` (or `sst diff` if `dry_run`).
8. After successful deploy, write the cross-stack contract values to SSM (§4.3) — the SST app does this as part of the run, not the workflow.
9. Output the resolved image tag, stage, and SST run URL as workflow outputs.

**Concurrency:** `concurrency: openclaw-deploy-${{ inputs.stage }}` with `cancel-in-progress: false`. Two simultaneous deploys to the same stage are illegal.

### 6.2 Calling the workflow from an API

Two supported callers:

1. **Internal admin tooling.** A fine-grained GitHub PAT scoped to `actions:write` on this repo. Example:

```bash
 gh api -X POST \
   /repos/Evans-Software-Solutions-Limited/axel-saas/actions/workflows/openclaw-deploy.yml/dispatches \
   -f ref=main \
   -f 'inputs[stage]=preprod' \
   -f 'inputs[openclaw_version]=v1.4.2'
```

2. **Backend admin endpoint** (optional, future): `POST /admin/openclaw/deploy` on the core API. Uses a GitHub App installation token (preferred over PAT) to call `POST /repos/{owner}/{repo}/actions/workflows/{id}/dispatches`. Gated by `requireAuth` + an admin role check.

**Important:** this workflow is for **infra and image deploys**, not for per-user session start. Per-user RunTask is too latency-sensitive (target < 5s) to go through GitHub Actions (typical workflow cold start: 30–90s).

---

## 7. Core API Changes (existing `microservices/core`)

Two new endpoints are added to the existing Elysia core API. They are protected by `requireAuth` and gated by subscription tier.

### 7.1 `POST /openclaw/sessions`

**Body:**

```json
{ "name": "my-workspace" }
```

The `name` is supplied by the caller and becomes the subdomain (`<name>.openclaw.<zone>` — see §9 for the per-stage zone). The user is derived from the JWT, never the body.

**Validation rules for `name`:**

| Rule                           | Value                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charset                        | `[a-z0-9-]` only                                                                                                                                                                                  |
| Length                         | 3–63 characters (DNS subdomain limit)                                                                                                                                                             |
| Edges                          | No leading or trailing `-`                                                                                                                                                                        |
| Uniqueness                     | Globally unique within the stage (one user can't take a name another already holds)                                                                                                               |
| Reserved blocklist             | `admin`, `api`, `auth`, `www`, `app`, `mail`, `health`, plus anything matching `axel-`\*                                                                                                          |
| Idempotency                    | If the same authenticated user re-submits a `name` they already own and a session is **running**, return that session (200, not 409). If the session is **stopped**, restart it on the same name. |
| Conflicts (other user owns it) | `409 Conflict`                                                                                                                                                                                    |

**Behaviour:**

1. Validate `name` against the rules above.
2. Look up or create a per-user EFS access point (`/users/<userId>`, POSIX UID/GID = stable hash of `userId`). Persist `accessPointId` in DB.
3. Enforce per-tier concurrency cap (§7.5). If exceeded, return `429`.
4. Generate `sessionId` (uuid v4) — internal handle, distinct from `name`.
5. Create a target group (`tg-<sessionId>`) for the task IP target type, port `18789`. Healthcheck: TCP on `18789` (HTTP path-based healthcheck deferred until OpenClaw is confirmed to expose a `/health` endpoint).
6. Add an ALB listener rule with host header `<name>.openclaw.<zone>` → target group.
7. `ecs:RunTask` with overrides: `AXEL_USER_ID`, `AXEL_SESSION_ID`, `AXEL_SESSION_NAME`, `AXEL_TIER`, EFS volume access point ID. CPU/memory per tier (§7.5). Network config: private subnets, task SG, no public IP.
8. Poll `DescribeTasks` until ENI is attached, register the private IP with the target group.
9. Return:

```json
{
  "sessionId": "...",
  "name": "my-workspace",
  "url": "https://my-workspace.openclaw.meetaxel.ai",
  "taskArn": "arn:aws:ecs:...",
  "expiresAt": "<startedAt + tier wall-clock cap>"
}
```

### 7.2 `DELETE /openclaw/sessions/:sessionId`

1. `ecs:StopTask`.
2. Deregister target, delete target group, delete listener rule.
3. (No Route53 cleanup — the wildcard record is shared and stays put.)
4. Persist `stoppedAt` in DB. Return `204`.

### 7.3 Persistence (new DB table)

| Column                | Type                                                     | Notes                  |
| --------------------- | -------------------------------------------------------- | ---------------------- |
| `id` (uuid)           | PK = `sessionId`                                         | Internal handle        |
| `user_id`             | FK                                                       | Owner                  |
| `name`                | string, unique per stage                                 | The DNS-safe subdomain |
| `task_arn`            | string                                                   |                        |
| `target_group_arn`    | string                                                   |                        |
| `listener_rule_arn`   | string                                                   |                        |
| `efs_access_point_id` | string                                                   |                        |
| `started_at`          | timestamp                                                |                        |
| `stopped_at`          | timestamp, nullable                                      |                        |
| `stopped_reason`      | enum: `user`, `reaper`, `error`, `tier_change`, nullable |                        |

Add a unique index on `name` (case-insensitive). Migration goes through `packages/db` per existing rules.

### 7.4 Auth model

- `requireAuth` on both endpoints.
- Authorisation: only the owner of the session can `DELETE` it. Admins (separate role) can stop any session.

### 7.5 Tier policy (concurrency cap and task sizing)

Centralised in a single config module `microservices/core/src/application/openclaw/tierPolicy.ts`. Defaults:

| Tier       | Max concurrent sessions per user                 | vCPU      | Memory | Wall-clock hard cap |
| ---------- | ------------------------------------------------ | --------- | ------ | ------------------- |
| Free       | 1                                                | 0.5 (512) | 1 GB   | 1 h                 |
| Premium    | 2                                                | 1 (1024)  | 2 GB   | 8 h                 |
| Enterprise | 10 (or per-contract override on the user record) | 2 (2048)  | 4 GB   | 24 h                |

These values are read from the policy module — not hardcoded in the SST app. The task definition in §4.2 is registered as a **family** with one revision per tier (or a single revision and CPU/memory passed via task override; whichever Fargate supports cleanly — Fargate accepts CPU/memory overrides only between supported (vCPU, memory) pairs, so we'll register one revision per tier to keep this safe).

The reaper (§10) reads the same tier policy and kills tasks that exceed their tier's wall-clock cap (not the global 8h fallback).

#### Tier vocabulary mismatch (call-out)

There are two tier vocabularies in the codebase and they don't match:

| Vocabulary        | Where it lives                                                                       | Values                                    |
| ----------------- | ------------------------------------------------------------------------------------ | ----------------------------------------- |
| Commercial / SaaS | `specs/README.md` ("Tier Model")                                                     | `Free`, `Premium`, `Enterprise`           |
| OpenClaw runtime  | `docker/openclaw/workspace-templates/openclaw-{starter,pro,business,developer}.json` | `starter`, `pro`, `business`, `developer` |

The Phase 5 API must own a single mapping function (`commercial → openclaw`) and pass the OpenClaw value to the container via `AXEL_TIER`. Until that mapping is locked, this spec uses the **commercial** vocabulary in this section (Free/Premium/Enterprise) and the **OpenClaw** vocabulary in `docker/openclaw/` (starter/pro/business/developer). Phase 5 PR is responsible for resolving this — not Phase 1 or Phase 2.

Suggested default mapping (subject to product confirmation): `Free → starter`, `Premium → pro`, `Enterprise → business` (with `developer` reserved for internal/admin use). This is **not** locked in this spec — Phase 5 PR will lock it.

---

## 8. Versioning & Bump Workflow

### 8.1 Bump procedure

1. PR edits `docker/openclaw/versions.json` and adds a row to a `CHANGELOG` entry referencing the OpenClaw release notes.
2. CI (PR check) verifies:

- The version is a valid semver-style tag.
- `gh release view <tag>` against the OpenClaw repo succeeds (the tag exists).
- Image builds locally with the new arg.

3. Merge to `main`.
4. Operator dispatches `openclaw-deploy.yml` with `stage=preprod`. Smoke test.
5. Dispatch with `stage=production`.

### 8.2 Why pin via `versions.json` rather than the workflow input

If the version is only an input, the source of truth becomes "whatever the last operator typed," which drifts. Pinning in the repo means: code review, `git blame`, rollback by `git revert`. The workflow input is a **temporary override** for testing, not the canonical version.

---

## 9. Networking Detail

### 9.1 Domains per stage

Aligned with the existing convention in `infra/domains/index.ts` (production owns `meetaxel.ai`, preprod owns `staging.meetaxel.ai`).

| Stage                   | OpenClaw zone (parent) | Wildcard                          | Example session URL                                  |
| ----------------------- | ---------------------- | --------------------------------- | ---------------------------------------------------- |
| `production`            | `meetaxel.ai`          | `*.openclaw.meetaxel.ai`          | `my-workspace.openclaw.meetaxel.ai`                  |
| `preprod`               | `staging.meetaxel.ai`  | `*.openclaw.staging.meetaxel.ai`  | `my-workspace.openclaw.staging.meetaxel.ai`          |
| `dev` / personal stages | none                   | none — ALB DNS name used directly | `<alb-dns>/?host=<name>` (no TLS, internal use only) |

### 9.2 Network topology

- **Default VPC**, default public subnets (one per AZ). No new VPC, no NAT gateway, no Transit Gateway.
- ALB in default public subnets, HTTPS-only (TLS 1.2+).
- Wildcard ACM cert for the stage's `*.openclaw.<zone>`. Issued in `eu-west-2`, DNS validation via the existing per-stage Route53 hosted zone.
- One Route53 wildcard ALIAS record: `*.openclaw.<zone>` → ALB DNS name.
- Per-session listener rule with host condition; rules are added/removed by the API.
- **Tasks run in default public subnets with `assign_public_ip = true`** (required for image pull from ECR and for OpenClaw's outbound MCP traffic without a NAT gateway).
- Two security groups:
  - **ALB SG**: ingress 443 from `0.0.0.0/0`; egress to task SG on 18789.
  - **Task SG**: ingress 18789 only from the ALB SG; egress to `0.0.0.0/0` (OpenClaw needs outbound for LLM APIs, MCP, integrations). NFS port 2049 to the EFS mount target SG.
- The fact that tasks have public IPs is not a security issue on its own — the task SG blocks all ingress except from the ALB. It is, however, a posture decision: log it in the threat model and revisit when traffic justifies NAT cost (§14).

---

## 10. Lifecycle, Cost & Reliability

**Locked decision: explicit start/stop only.** This is a real cost risk for a per-user model. Mitigations are non-negotiable for v0:

1. **Hard wall-clock backstop.** Reaper Lambda kills any task whose `startedAt` is older than its **tier's wall-clock cap** (§7.5). Ships in this SST app, not optional.
2. **Per-user concurrency cap.** Tier-driven (§7.5). Enforced server-side in the API.
3. **CloudWatch alarms.**

- Active tasks > 90 → page on-call (ALB rule cap is ~100 per listener, see §11).
- Tasks running > 6h → warn on-call (precursor to reaper kill).
- Reaper Lambda errors → page.

4. **Stop on subscription cancel.** Existing Stripe webhook handler triggers `DELETE /openclaw/sessions/:id` for all active sessions belonging to the cancelled user.
5. **Daily cost report** via existing Cost Explorer setup (out of scope here but called out as a follow-up).

---

## 11. Known Limits & Future Work

| Limit                     | Today                              | Mitigation path                                                                                                                                               |
| ------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ALB listener rules per LB | ~100 host-based rules              | Sharded ALBs (rule count < 100 each) keyed by `hash(sessionId) % N`, or a custom routing proxy in front of internal Cloud Map. Revisit at 80 active sessions. |
| EFS standard throughput   | Burst on small workloads           | Provisioned throughput per stage if needed.                                                                                                                   |
| ECS RunTask cold start    | 30–90s for Fargate cold image pull | Smaller image; warm pool of pre-warmed tasks (post-MVP).                                                                                                      |
| Workflow dispatch latency | 30–90s                             | Acceptable for infra deploys only. **Not** used per-session.                                                                                                  |

---

## 12. Acceptance Criteria

- `apps/openclaw/sst.config.ts` exists with SST app name `openclaw`, deploys cleanly with `sst deploy --stage preprod` and `sst deploy --stage production`. No imports from the root `infra/` directory. No new VPC is created — the default VPC is used (verify in CloudFormation diff).
- `docker/openclaw/Dockerfile` builds with no `@latest` references; `versions.json` is the only source of truth. The original `docker/user-container/` is unchanged.
- `.github/workflows/openclaw-deploy.yml` is `workflow_dispatch` only; can be invoked via `gh api ... /workflows/openclaw-deploy.yml/dispatches`; idempotent on re-run with the same image tag.
- `POST /openclaw/sessions` returns a working `https://<name>.openclaw.<zone>` URL (per §9.1) within 60s; the page is reachable on `:18789` (TCP) and the ALB target is `healthy`.
- `DELETE /openclaw/sessions/:id` stops the task, deregisters the target, removes the listener rule, and the subdomain returns 404 within 30s.
- Reaper Lambda kills a task whose `startedAt` is > 8h.
- CloudWatch alarms exist for: active tasks > 90, tasks > 6h, reaper errors.
- SSM parameters under `/axel/<stage>/openclaw/`\* are populated after deploy.
- Tier gating: free-tier user is blocked from `POST /openclaw/sessions` (or capped per tier policy).
- Stripe cancellation webhook tears down active sessions for the cancelled user.
- Coverage on new code in `microservices/core` ≥ 90% (per repo rule).
- All quality gates pass: prettier, typecheck, lint, build, test (per `CLAUDE.md`).

---

## 13. Locked Decisions

| #   | Topic                                              | Decision                                                                                                                                                         |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Region                                             | `eu-west-2`                                                                                                                                                      |
| 2   | App / SST naming                                   | App and SST app name are both `openclaw`. Repo paths: `apps/openclaw/`, `docker/openclaw/`. ECR repo: `openclaw`. Cluster: `openclaw-<stage>`.                   |
| 3   | VPC                                                | **No new VPC.** Use the AWS default VPC, default public subnets, tasks with public IPs locked down by SG. See §14 for cost rationale, §9.2 for security posture. |
| 4   | OpenClaw source                                    | `github.com/openclaw/openclaw`, installed via `npm install -g github:openclaw/openclaw#<tag>`. Version pinned in `docker/openclaw/versions.json`.                |
| 5   | Source files in `docker/openclaw/`                 | **Copied** (not moved) from `docker/user-container/`. The original directory is left untouched.                                                                  |
| 6   | Subdomain                                          | Caller-supplied `name` parameter. Validation rules in §7.1.                                                                                                      |
| 7   | Tier policy (concurrency + task size + wall-clock) | Defaults in §7.5. Centralised in `tierPolicy.ts`.                                                                                                                |
| 8   | Idempotency on session start                       | Re-submitting the same `name` for the same owner returns the running session (200) or restarts it on the same name; cross-user collision returns 409.            |
| 9   | Domain layout per stage                            | Production: `*.openclaw.meetaxel.ai`. Preprod: `*.openclaw.staging.meetaxel.ai`. Dev: ALB DNS direct. (Aligns with `infra/domains/index.ts`.)                    |

No blockers remain for scaffolding the SST app, the Dockerfile, the workflow, and the new core API endpoints.

---

## 14. Cost Estimate & Optimisations

All figures are eu-west-2 on-demand list prices, rounded for clarity. **Treat as planning estimates**, not invoices. Real bill depends on actual usage.

### 14.1 Fixed monthly cost ("idle bill" — what you pay before any user starts a session)

The §13 decision to use the default VPC removes the largest fixed cost. With the spec as locked:

| Item                                         | Quantity               | ~Monthly cost  |
| -------------------------------------------- | ---------------------- | -------------- |
| ALB (one per stage, idle)                    | 1 × $0.0225/hr         | ~$16           |
| ALB LCU charges (idle)                       | minimal                | ~$0–2          |
| ECR storage                                  | ~5 GB images           | ~$0.50         |
| EFS storage (Standard)                       | 10 GB across all users | ~$3            |
| EFS provisioned throughput                   | not used (burst only)  | $0             |
| Route53 hosted zone (already exists, reused) | —                      | $0             |
| ACM cert                                     | —                      | $0             |
| CloudWatch Logs storage (7d retention)       | ~5 GB ingest/mo        | ~$3            |
| Reaper Lambda                                | 96 invocations/day     | <$1            |
| **Subtotal idle, one stage**                 |                        | **~$23/month** |
| × 2 stages (preprod + production)            |                        | **~$46/month** |

**Compare to the dedicated-VPC option** that we rejected: a 2-AZ NAT gateway adds ~$65/month/stage in NAT idle plus per-GB data processing — roughly **+$130/month for the two stages combined**, before any user traffic. Skipping it is the single biggest cost win in the spec.

### 14.2 Variable cost per session (Fargate per second)

eu-west-2 Fargate Linux/x86 on-demand: ~$0.04048 per vCPU-hour + ~$0.004445 per GB-hour.

| Tier       | Config          | Per-hour | Cost at tier wall-clock cap (worst case) |
| ---------- | --------------- | -------- | ---------------------------------------- |
| Free       | 0.5 vCPU / 1 GB | $0.0247  | $0.025 (1h cap)                          |
| Premium    | 1 vCPU / 2 GB   | $0.0494  | $0.395 (8h cap)                          |
| Enterprise | 2 vCPU / 4 GB   | $0.0987  | $2.37 (24h cap)                          |

### 14.3 Illustrative monthly variable cost

These are model-the-business numbers, not commitments. Adjust the assumptions and the totals scale linearly.

**Assumptions:**

- 100 Free users × 1 session/week × 30 min average → 100 × 4 × 0.5h × $0.0247 ≈ **$5/mo**
- 50 Premium users × 5 sessions/week × 2h average → 50 × 20 × 2h × $0.0494 ≈ **$99/mo**
- 5 Enterprise users × 5 sessions/week × 4h average → 5 × 20 × 4h × $0.0987 ≈ **$40/mo**

**Variable subtotal:** ~$144/month at this load.

### 14.4 Total run-rate at the illustrative load

|                                         | Preprod  | Production | Total           |
| --------------------------------------- | -------- | ---------- | --------------- |
| Idle                                    | ~$23     | ~$23       | ~$46            |
| Variable (assume preprod is 5% of prod) | ~$7      | ~$144      | ~$151           |
| **Total**                               | **~$30** | **~$167**  | **~$197/month** |

Per Premium user (£49/mo) at ~$2 of Fargate cost per month, gross margin on infrastructure alone is ~95%. Healthy.

### 14.5 Cost optimisations, ranked by impact

Listed in order of `expected $/month saved` ÷ `engineering effort`. Higher-up items are the ones to do first.

#### 1. (Already taken) No dedicated VPC, no NAT gateway

Saves ~$65/month/stage idle. **Locked in §13.3.**

#### 2. Idle-traffic auto-stop (currently rejected — call out the cost trade)

The spec locks "explicit stop only", but a 5-min "no requests" idle reaper would crush variable cost in real usage. Users routinely leave tabs open: the `8h × $0.05 = $0.40` Premium worst case becomes the typical case if nothing reaps idle tasks.

Estimated saving at the §14.3 load: **40–70% of variable cost**, i.e. ~$60–100/month at production scale. Strongly recommend revisiting the locked decision once we have real telemetry. A conservative version — "no requests for 30 minutes → stop" — gives most of the benefit with negligible UX cost.

#### 3. CloudWatch Logs retention = 7 days

`/aws/ecs/openclaw/`\* log groups should default to 7-day retention, not infinite. Without this, OpenClaw's per-session debug output accumulates forever at $0.03/GB/month and grows unbounded.

Saving: ~$1–10/month at our scale; large at scale.

#### 4. Fargate Spot for Free tier

Free tier sessions are short (1h cap), low-revenue, and tolerable to terminate on 2-min notice. Running them on Fargate Spot gives ~70% off vCPU/RAM.

Saving: ~$2–5/month today, but it's also a moat: at 1000 free users it's the difference between viable and not.

Caveat: Spot is _not_ appropriate for paid tiers (Premium, Enterprise) — random kills wreck UX.

#### 5. EFS lifecycle to Infrequent Access (IA) after 30 days

`Standard → IA` transition costs $0.30/GB-month vs $0.025/GB-month. For dormant user workspaces this is a one-line config change with no behavioural impact (slight read latency on cold files).

Saving: small today (~$1–5/month), grows with cumulative user count.

#### 6. Smaller Free tier task (0.25 vCPU / 0.5 GB)

Fargate's smallest configuration. Halves Free-tier per-session cost. **Risk:** OpenClaw may not run reliably at 0.25 vCPU / 0.5 GB. Validate in Phase 1 (local Docker) by setting `cpus: 0.25, mem_limit: 512m` and stress-testing before committing.

Saving: ~~50% of Free variable cost (~~$2–3/month at illustrative load; significant at scale).

#### 7. Compute Savings Plans (defer until predictable)

Up to ~50% off Fargate for a 1-year commitment. **Don't do this until you have 3 months of stable usage data** — Savings Plans on the wrong baseline turn into a fixed cost worse than on-demand.

Saving (potential): up to ~$70/month at the illustrative load, but only if the baseline is genuine.

#### 8. VPC endpoints for ECR + S3

Only matters if we revisit private subnets + NAT in the future. Cuts ~50–80% of NAT data charges at the cost of ~$7/month per endpoint per AZ. **Not relevant today** because we're not running NAT.

#### 9. ALB consolidation across stages

Currently one ALB per stage (~$16/month each). Could share one ALB across preprod + production via host-based routing — saves ~$16/month but couples the stages, which violates the locked "no cross-stage coupling" pattern. **Not recommended.**

### 14.6 Summary

- Default VPC + no NAT is the locked, optimal choice for v0 and saves ~$130/month vs the dedicated-VPC alternative.
- Idle bill is **~$46/month across both stages**.
- Variable bill scales linearly with active sessions; per-user infra margin is ~95% of subscription revenue.
- The single biggest _future_ cost lever is **idle-traffic auto-stop**, currently rejected by spec. Revisit when telemetry justifies.
- Don't buy Savings Plans, don't add VPC endpoints, until there are 3+ months of stable load to model against.
