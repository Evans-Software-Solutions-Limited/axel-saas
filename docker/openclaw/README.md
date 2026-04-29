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

| File | Purpose |
| --- | --- |
| `Dockerfile` | Pinned-version image build. Requires `OPENCLAW_VERSION` build arg. |
| `versions.json` | Single source of truth for the pinned OpenClaw release tag. |
| `docker-compose.yml` | Local-only — reads `versions.json` default, named volume, TCP healthcheck. |
| `docker-entrypoint.sh` | Seeds workspace from templates on first boot, applies tier rules. |
| `workspace-templates/` | Per-tier `openclaw.json` configs and seed markdown files (`SOUL.md`, etc.). |

## Bumping the pinned version

1. Edit `versions.json` (one line).
2. Verify the tag exists: `gh release view <tag> --repo openclaw/openclaw`.
3. Rebuild locally: `docker compose -f docker/openclaw/docker-compose.yml build`.
4. Smoke test (gateway boots, port 18789 open, workspace seeded).
5. Commit, open a PR. Tag bumps are explicit, never automatic.

## Tier vocabulary

OpenClaw's internal tier names (`starter` / `pro` / `business` / `developer`) are not the same as Axel's commercial subscription tiers (`Free` / `Premium` / `Enterprise`). The mapping between them is the responsibility of the core API in **Phase 5** of the spec — not this image. This image only knows about the OpenClaw vocabulary.

## What this image does NOT do

- It does not assume any AWS context (no ECR, no EFS, no ECS).
- It does not configure OpenClaw beyond what the workspace templates already specify.
- It does not enforce concurrency caps or wall-clock limits — those are runtime concerns in Phase 5/6.

## Why npm and not `github:`

OpenClaw's `package.json` declares `"main": "dist/index.js"` and lists `dist/` in its `files` array, but `dist/` is **built at publish time** and is not committed to the GitHub source tree. Installing via `npm install -g github:openclaw/openclaw#<tag>` therefore fails: npm clones the source, but there is no `prepare` script to compile `dist/`, and the `preinstall` lifecycle hook trips before that anyway. (`Cannot find module .../scripts/preinstall-package-manager-warning.mjs` during the git-clone temp dir cleanup.)

The npm registry version `openclaw@<version>` is the pre-built tarball for the matching GitHub release: same source SHA, same release notes, just packaged. `versions.json` keeps the **GitHub release tag** as the canonical reference (so `git blame` and release notes line up), and the Dockerfile strips the leading `v` to derive the npm version.
