FROM node:22-slim

# OPENCLAW_VERSION is the GitHub release tag (e.g. v2026.4.26). Source of truth: versions.json.
# We install from the npm registry — npm publishes pre-built tarballs (with `dist/`) for each
# GitHub release; `npm install -g github:...` does not work because OpenClaw's `dist/` is built
# at publish time and is not committed to the source tree.
ARG OPENCLAW_VERSION
ARG OPENCLAW_REPO=openclaw/openclaw

RUN test -n "$OPENCLAW_VERSION" || (echo "OPENCLAW_VERSION build arg is required (read from versions.json)" && exit 1)

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*

# Strip the leading 'v' from the GitHub tag to get the npm semver (POSIX shell parameter expansion).
# v2026.4.26 -> 2026.4.26
RUN NPM_VERSION="${OPENCLAW_VERSION#v}" \
 && echo "Installing openclaw@${NPM_VERSION} (built from github.com/${OPENCLAW_REPO} tag ${OPENCLAW_VERSION})" \
 && npm install -g "openclaw@${NPM_VERSION}"

RUN mkdir -p /data/workspace /data/workspace-templates

COPY workspace-templates/ /data/workspace-templates/

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

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
