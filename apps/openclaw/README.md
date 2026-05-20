# `@axel-saas/openclaw-infra` — Phase 2 SST app

Provisions the long-lived AWS resources the OpenClaw Fargate runtime
needs: ECR, ECS cluster, EFS, IAM roles, ALB with a default 404
listener, task definitions for all three tiers, and SSM parameter
writes for the cross-stack contract.

This is a **separate, independent SST v3 app** from the root
`axel-saas` SST config at the repo root. Same AWS accounts, same
stages, but no cross-stack `sst.Linkable` references. The boundary
is intentional per `docs/openclaw-fargate-spec.md` §1 — the core
API reads everything it needs from SSM Parameter Store (`/axel/<stage>/openclaw/*`).

## What's in scope (Phase 2)

- ECR repo (`openclaw-<stage>`) with image scanning + 30-image retention.
- ECS cluster (`openclaw-<stage>`) with Fargate + Fargate Spot capacity providers.
- EFS file system with mount targets in all default-VPC subnets and 30-day IA transition.
- Three IAM roles: task role (empty for now), execution role (ECR pull + logs), API caller role (assumed by the core API Lambda in Phase 5).
- Three security groups: ALB SG (443 from the world), task SG (18789 from ALB only, full egress), EFS SG (2049 from task SG only).
- ALB with a default-404 HTTP-80 listener. **HTTPS comes in Phase 3** alongside the wildcard ACM cert.
- Three task definitions (Free / Premium / Enterprise) with per-tier (vCPU, memory). Image URI is `<ecr-repo>:bootstrap` — see [Bootstrap image](#bootstrap-image-one-time-operator-step) below.
- SSM parameters under `/axel/<stage>/openclaw/*` for the cross-stack contract.

## What's NOT in scope (deferred to later phases)

- **Phase 3** — DNS (Route53 wildcard ALIAS + ACM wildcard cert). Listener stays HTTP-80 until Phase 3 lands.
- **Phase 4** — `.github/workflows/openclaw-deploy.yml`. Phase 2 is `sst deploy` from a local CLI; Phase 4 makes it `workflow_dispatch` from CI.
- **Phase 5** — `POST /openclaw/sessions` in the core API + per-user EFS access points + ALB per-session rules. The API caller role is wired up but unassumable from outside this stack until Phase 5 grants the core API Lambda explicit `sts:AssumeRole`.
- **Phase 6** — reaper Lambda + CloudWatch alarms.

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

## Verification (Phase 2 exit criteria)

Per the Fargate spec §1a "Phase 2" exit criteria:

```bash
# (1) Deploy succeeds end-to-end.
cd apps/openclaw && bun x sst deploy --stage staging

# (2) ALB DNS returns 404 (confirms listener works).
ALB_DNS=$(aws ssm get-parameter \
  --name /axel/staging/openclaw/alb-dns-name \
  --query Parameter.Value --output text)
curl -i "http://${ALB_DNS}/"
# Expected: HTTP/1.1 404 Not Found  →  body "Not Found"

# (3) Cross-stack contract is populated.
aws ssm get-parameter --name /axel/staging/openclaw/cluster-arn
# Expected: a valid ARN

aws ssm get-parameters-by-path \
  --path /axel/staging/openclaw \
  --query 'Parameters[].Name' --output table
# Expected: cluster-arn, task-definition-arns, subnet-ids,
#           task-security-group-id, efs-file-system-id,
#           alb-listener-arn, alb-dns-name, api-caller-role-arn

# (4) No new VPC was created.
aws cloudformation describe-stack-resources \
  --stack-name <stack-name-from-sst-output> \
  --query 'StackResources[?ResourceType==`AWS::EC2::VPC`]'
# Expected: empty

# (5) `sst remove` tears everything down cleanly.
bun x sst remove --stage staging
```

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
    alb.ts            # ALB + HTTP-80 listener with 404 default action
    taskDefinition.ts # 3 task definitions (one per tier)
    ssm.ts            # Cross-stack contract under /axel/<stage>/openclaw/*
```

The order of imports in `sst.config.ts` is significant — modules
that reference others must load after their dependencies.
