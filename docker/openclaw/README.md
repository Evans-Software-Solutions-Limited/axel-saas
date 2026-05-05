# `docker/openclaw/` — OpenClaw runtime image

Docker image for the OpenClaw runtime that powers Axel's per-user sessions on Fargate. This is **Phase 1** of the OpenClaw-on-Fargate spec (see [`docs/openclaw-fargate-spec.md`](../../docs/openclaw-fargate-spec.md)) — local Docker only, no AWS.

The contents of this directory were copied from `docker/user-container/` and modified to:

- pin OpenClaw to a specific GitHub release tag (no floating tags),
- read that version from `versions.json` (single source of truth),
- install from the npm registry — `openclaw@<version>` is the pre-built tarball matching the GitHub release tag (see [Why npm and not `github:`](#why-npm-and-not-github) below),
- accept the `AXEL_*` env vars used by the Phase 5 ECS task overrides,
- run via `tini` with a TCP healthcheck on port `18789`.

The original `docker/user-container/` is **left untouched** — both directories coexist until the legacy path is retired.

## Local quickstart

From the repo root:

```bash
# Required — no sane default; we refuse to ship `dev-token-change-me` style
# fallbacks. For local-only smoke testing without auth, set OPENCLAW_DEV_MODE=1
# and skip this.
export OPENCLAW_GATEWAY_TOKEN=$(uuidgen)

# Optional — defaults to `free`. One of: free, premium, enterprise.
export AXEL_TIER=free

docker compose -f docker/openclaw/docker-compose.yml up --build
```

OpenClaw's gateway listens on `http://localhost:18789`. To verify:

```bash
nc -z localhost 18789 && echo "gateway up"
```

To wipe the workspace volume and start fresh:

```bash
docker compose -f docker/openclaw/docker-compose.yml down -v
```

## Files

| File                   | Purpose                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`           | Pinned-version image build. Requires `OPENCLAW_VERSION` build arg.                                                                                      |
| `versions.json`        | Single source of truth for the pinned OpenClaw release tag.                                                                                             |
| `docker-compose.yml`   | Local-only — reads `versions.json` default, named volume, TCP healthcheck.                                                                              |
| `docker-entrypoint.sh` | Seeds workspace from templates on first boot, applies tier rules, validates `OPENCLAW_GATEWAY_TOKEN`.                                                   |
| `workspace-templates/` | Per-tier `openclaw.json` configs (`openclaw-free.json`, `openclaw-premium.json`, `openclaw-enterprise.json`) and seed markdown files (`SOUL.md`, etc.). |

## Bumping the pinned version

1. Edit `versions.json` (one line).
2. Verify the tag exists: `gh release view <tag> --repo openclaw/openclaw`.
3. Rebuild locally: `docker compose -f docker/openclaw/docker-compose.yml build`.
4. Smoke test (gateway boots, port 18789 open, workspace seeded).
5. Commit, open a PR. Tag bumps are explicit, never automatic.

## Tier vocabulary

The per-tier `openclaw-*.json` files in `workspace-templates/` are **our** authored templates — they are not provided by upstream OpenClaw. We name them after Axel's commercial tiers (`free` / `premium` / `enterprise`, set via `AXEL_TIER`) so the entrypoint can pick the right one without a separate mapping layer.

Current shape (model-only differentiation; concurrency / wall-clock caps live in Phase 5/6):

| `AXEL_TIER`  | Default model      | Capabilities (per `SOUL.md` / `AGENTS.md`)                            |
| ------------ | ------------------ | --------------------------------------------------------------------- |
| `free`       | `anthropic/haiku`  | No code execution, no sub-agents, web tools only                      |
| `premium`    | `anthropic/sonnet` | Sub-agents, browser/canvas/nodes automation, no direct code execution |
| `enterprise` | `anthropic/sonnet` | Full capabilities — code execution, sub-agents, all tools             |

The legacy `TIER` env var (`starter` / `pro` / `business` / `developer`) is no longer accepted; the docker entrypoint will refuse to boot if it sees an unknown tier value. Phase 5 ECS task overrides supply `AXEL_TIER` directly from the user's subscription.

## What this image does NOT do

- It does not assume any AWS context (no ECR, no EFS, no ECS).
- It does not configure OpenClaw beyond what the workspace templates already specify.
- It does not enforce concurrency caps or wall-clock limits — those are runtime concerns in Phase 5/6.

## Why npm and not `github:`

OpenClaw's `package.json` declares `"main": "dist/index.js"` and lists `dist/` in its `files` array, but `dist/` is **built at publish time** and is not committed to the GitHub source tree. Installing via `npm install -g github:openclaw/openclaw#<tag>` therefore fails: npm clones the source, but there is no `prepare` script to compile `dist/`, and the `preinstall` lifecycle hook trips before that anyway. (`Cannot find module .../scripts/preinstall-package-manager-warning.mjs` during the git-clone temp dir cleanup.)

The npm registry version `openclaw@<version>` is the pre-built tarball for the matching GitHub release: same source SHA, same release notes, just packaged. `versions.json` keeps the **GitHub release tag** as the canonical reference (so `git blame` and release notes line up), and the Dockerfile strips the leading `v` to derive the npm version.
