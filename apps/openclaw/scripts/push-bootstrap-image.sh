#!/usr/bin/env bash
#
# push-bootstrap-image.sh — one-time operator step to push the
# `${ECR_REPO_URI}:bootstrap` image referenced by the openclaw task
# definitions. Until Phase 4's deploy workflow takes over per-commit
# image pushes, this is what makes RunTask actually work.
#
# Usage:
#   STAGE=staging ./apps/openclaw/scripts/push-bootstrap-image.sh
#
# Prerequisites:
#   - AWS CLI authenticated to the target account (staging or production)
#   - Docker daemon running with buildx support (for --platform linux/amd64)
#   - The openclaw SST app has been deployed at least once to STAGE
#     (i.e. the openclaw-${STAGE} ECR repo exists)
#   - The bridge plugin must be built — this script runs `bun run build`
#     for @axel-saas/openclaw-bridge-plugin before docker build, because
#     the Dockerfile COPYs its dist/ folder
#
# What it does:
#   1. Resolves the ECR URI from `openclaw-${STAGE}`
#   2. Logs into ECR
#   3. Builds the bridge plugin (required before docker build)
#   4. Builds the OpenClaw image with the version from versions.json
#   5. Tags + pushes as :bootstrap
#   6. Verifies the image is present in ECR
#
# Idempotent: safe to re-run. Overwrites the existing :bootstrap tag.

set -euo pipefail

STAGE="${STAGE:-}"
if [[ -z "$STAGE" ]]; then
  echo "ERROR: STAGE env var required (e.g. STAGE=staging)" >&2
  exit 1
fi

AWS_REGION="${AWS_REGION:-eu-west-2}"

# Resolve repo root from script location — script may be invoked from anywhere.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# ── Production guard ─────────────────────────────────────────────
# The task definitions hard-pin `:bootstrap` (taskDefinition.ts:116),
# so pushing to production overwrites the image RunTask pulls for
# every new session. The rest of the openclaw stack treats production
# with kid gloves (removal: "retain", protect: ["production"] in
# sst.config.ts); this script should match that posture. Force the
# operator to type "production" rather than autopilot through a typo.
if [[ "$STAGE" == "production" ]]; then
  echo "⚠️  About to push openclaw:bootstrap to PRODUCTION ECR."
  echo "    Task definitions hard-pin :bootstrap, so this image becomes"
  echo "    the one every new session pulls. Confirm by typing 'production':"
  read -r CONFIRM
  if [[ "$CONFIRM" != "production" ]]; then
    echo "Aborted." >&2
    exit 1
  fi
fi

echo "── 1. Resolve ECR URI ────────────────────────────────────────────"
# Explicit error path so the operator gets a useful pointer instead of
# the raw AWS RepositoryNotFoundException when the SST app hasn't
# been deployed yet (the openclaw SST app creates this repo).
ECR_URI=$(aws ecr describe-repositories \
  --repository-names "openclaw-${STAGE}" \
  --region "${AWS_REGION}" \
  --query 'repositories[0].repositoryUri' --output text 2>/dev/null) || {
    echo "ERROR: ECR repo openclaw-${STAGE} not found." >&2
    echo "       Deploy the openclaw SST app first:" >&2
    echo "         cd apps/openclaw && bun x sst deploy --stage ${STAGE}" >&2
    exit 1
  }
echo "ECR URI: ${ECR_URI}"

echo "── 2. Login to ECR ───────────────────────────────────────────────"
aws ecr get-login-password --region "${AWS_REGION}" \
  | docker login --username AWS --password-stdin "${ECR_URI%/*}"

echo "── 3. Build bridge plugin ────────────────────────────────────────"
cd "${REPO_ROOT}"
bun install
# Clear any stale artefacts from a prior aborted build before rebuilding.
# `bun build` does NOT clean its --outdir, so leftover files would get
# COPY'd into the image (Dockerfile line 55) and shipped to ECR.
rm -rf packages/openclaw-bridge-plugin/dist
bun run --filter @axel-saas/openclaw-bridge-plugin build

# Preflight: confirm the build actually produced the expected entry.
# Without this, a silent build failure surfaces 5+ minutes later as
# a cryptic Docker `COPY failed: no source files were specified`.
if [[ ! -f packages/openclaw-bridge-plugin/dist/index.js ]]; then
  echo "ERROR: bridge plugin build did not produce dist/index.js" >&2
  echo "       Check the build output above for errors." >&2
  exit 1
fi

echo "── 4. Build OpenClaw image ───────────────────────────────────────"
OPENCLAW_VERSION=$(jq -r .openclaw docker/openclaw/versions.json)
# `jq -r` returns the literal string "null" (exit 0) when the key is
# missing, which would silently propagate into `npm install -g openclaw@null`
# inside the docker build. Guard explicitly.
if [[ -z "$OPENCLAW_VERSION" || "$OPENCLAW_VERSION" == "null" ]]; then
  echo "ERROR: docker/openclaw/versions.json is missing the 'openclaw' key" >&2
  exit 1
fi
echo "Building openclaw:bootstrap with OPENCLAW_VERSION=${OPENCLAW_VERSION}"

# Context = repo root. The Dockerfile COPYs both docker/openclaw/ AND
# packages/openclaw-bridge-plugin/dist/ so it needs the full tree.
docker build --platform linux/amd64 \
  --build-arg "OPENCLAW_VERSION=${OPENCLAW_VERSION}" \
  -t openclaw:bootstrap \
  -f docker/openclaw/Dockerfile \
  .

echo "── 5. Tag + push ─────────────────────────────────────────────────"
docker tag openclaw:bootstrap "${ECR_URI}:bootstrap"
docker push "${ECR_URI}:bootstrap"

echo "── 6. Verify ─────────────────────────────────────────────────────"
aws ecr describe-images \
  --repository-name "openclaw-${STAGE}" \
  --region "${AWS_REGION}" \
  --image-ids imageTag=bootstrap \
  --query 'imageDetails[0].{Digest:imageDigest,Pushed:imagePushedAt,Size:imageSizeInBytes}' \
  --output table

echo
echo "✅ Pushed openclaw-${STAGE}:bootstrap (version ${OPENCLAW_VERSION})"
echo "   RunTask against the task definitions should now succeed."
