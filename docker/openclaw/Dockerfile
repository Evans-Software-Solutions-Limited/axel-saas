# Build context for this Dockerfile is the **repo root** (set in
# `docker/openclaw/docker-compose.yml`), not `docker/openclaw/`. This
# is so the OpenClaw bridge plugin (which lives in
# `packages/openclaw-bridge-plugin/`) can be COPY'd into the image.
# A `.dockerignore` at the repo root keeps the upload small.

FROM node:22-slim

# OPENCLAW_VERSION is the GitHub release tag (e.g. v2026.9.2). Source of truth: versions.json.
# We install from the npm registry — npm publishes pre-built tarballs (with `dist/`) for each
# GitHub release; `npm install -g github:...` does not work because OpenClaw's `dist/` is built
# at publish time and is not committed to the source tree. From 2026.5.2 onward the npm-first
# install pipeline is the recommended path; 2026.5.4-beta.1 surfaces real plugin module
# evaluation errors instead of silently swallowing them, which is what catches the failure
# class hit during PR #99 debugging.
ARG OPENCLAW_VERSION
ARG OPENCLAW_REPO=openclaw/openclaw

RUN test -n "$OPENCLAW_VERSION" || (echo "OPENCLAW_VERSION build arg is required (read from versions.json)" && exit 1)

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

# Strip the leading 'v' from the GitHub tag to get the npm semver (POSIX shell parameter expansion).
# v2026.9.2 -> 2026.9.2
RUN NPM_VERSION="${OPENCLAW_VERSION#v}" \
 && echo "Installing openclaw@${NPM_VERSION} (built from github.com/${OPENCLAW_REPO} tag ${OPENCLAW_VERSION})" \
 && npm install -g "openclaw@${NPM_VERSION}"

RUN mkdir -p /data/workspace /data/workspace-templates /opt/axel-bridge

COPY docker/openclaw/workspace-templates/ /data/workspace-templates/

COPY docker/openclaw/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ── Axel bridge plugin ──────────────────────────────────────────────
# Copy the pre-built plugin artefacts (manifest + bundled `dist/`) into
# the image at a stable path. The actual `openclaw plugins install
# --link` step runs in the entrypoint, NOT here at build time, because
# the entrypoint symlinks the workspace's `openclaw.json` over
# `/root/.openclaw/openclaw.json` and a build-time install would write
# its registry entry to the latter — getting wiped by the symlink at
# every container start. Installing in the entrypoint writes the
# registry entry to the workspace config (the live target) so the
# gateway sees the plugin on its first boot.
#
# CI/build prerequisite: `bun run --filter @axel-saas/openclaw-bridge-plugin build`
# must have been executed before `docker compose build` so `dist/index.js`
# exists. Locally, the developer's `bun install && bun run build`
# habit is enough.
COPY packages/openclaw-bridge-plugin/package.json     /opt/axel-bridge/package.json
COPY packages/openclaw-bridge-plugin/openclaw.plugin.json /opt/axel-bridge/openclaw.plugin.json
COPY packages/openclaw-bridge-plugin/dist/            /opt/axel-bridge/dist/

ENV OPENCLAW_VERSION=${OPENCLAW_VERSION}
LABEL org.opencontainers.image.source="https://github.com/${OPENCLAW_REPO}"
LABEL org.opencontainers.image.version="${OPENCLAW_VERSION}"

WORKDIR /data/workspace

EXPOSE 18789

# TCP probe via bash builtin /dev/tcp — no extra deps.
# start-period accommodates first-boot plugin install (~5–10s) plus gateway
# startup (~8s). 20s was too tight in the #98 spike; 90s gives generous headroom.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD bash -c '(echo > /dev/tcp/127.0.0.1/18789) >/dev/null 2>&1' || exit 1

ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]
CMD ["openclaw", "gateway", "run"]
