#!/bin/bash
set -euo pipefail

# OpenClaw container entrypoint.
#
# Env vars (all optional in Phase 1; required for Phase 5 ECS task overrides):
#   AXEL_USER_ID         Stable Axel user ID (used for log correlation).
#   AXEL_SESSION_ID      Unique per task launch (used for log correlation).
#   AXEL_SESSION_NAME    Caller-supplied subdomain name (informational only here).
#   AXEL_TIER            Subscription tier — one of: free, premium, enterprise.
#                        Defaults to `free`. The legacy `TIER` env var
#                        (starter / pro / business / developer) is no longer
#                        accepted; an unknown value causes a hard exit.
#
# Workspace path is fixed to /data/workspace because the OpenClaw config files in
# workspace-templates/ hardcode that path. Do not change without updating those.

WORKSPACE=/data/workspace
TEMPLATES=/data/workspace-templates

TIER="${AXEL_TIER:-free}"

# OPENCLAW_GATEWAY_TOKEN is required to talk to the gateway. We refuse to boot
# without it rather than silently using a weak/empty token — past leaks into
# prod from compose defaults like `dev-token-change-me` motivate this. Set
# OPENCLAW_DEV_MODE=1 to allow boot without a token for local-only smoke
# testing where you do not need authenticated requests.
if [ -z "${OPENCLAW_GATEWAY_TOKEN:-}" ]; then
  if [ "${OPENCLAW_DEV_MODE:-0}" = "1" ]; then
    echo "[openclaw-entrypoint] OPENCLAW_GATEWAY_TOKEN unset; OPENCLAW_DEV_MODE=1 — continuing"
  else
    echo "[openclaw-entrypoint] OPENCLAW_GATEWAY_TOKEN must be set. Export it (e.g. export OPENCLAW_GATEWAY_TOKEN=\$(uuidgen)) or set OPENCLAW_DEV_MODE=1 for local-only smoke testing." >&2
    exit 1
  fi
fi

echo "[openclaw-entrypoint] starting (tier=${TIER}, user=${AXEL_USER_ID:-unset}, session=${AXEL_SESSION_ID:-unset}, name=${AXEL_SESSION_NAME:-unset})"

# Seed workspace from templates only if empty, so user state on the volume
# survives container restarts.
for f in SOUL.md USER.md MEMORY.md AGENTS.md TOOLS.md HEARTBEAT.md; do
  if [ ! -f "$WORKSPACE/$f" ]; then
    echo "[openclaw-entrypoint] first boot: copying template $f"
    cp "$TEMPLATES/$f" "$WORKSPACE/$f"
  fi
done

if [ ! -f "$WORKSPACE/openclaw.json" ]; then
  echo "[openclaw-entrypoint] first boot: copying tier config (${TIER})"
  if [ ! -f "$TEMPLATES/openclaw-${TIER}.json" ]; then
    echo "[openclaw-entrypoint] unknown tier '${TIER}', no template at $TEMPLATES/openclaw-${TIER}.json" >&2
    exit 1
  fi
  cp "$TEMPLATES/openclaw-${TIER}.json" "$WORKSPACE/openclaw.json"
fi

# Tier-specific copy injected into SOUL.md / AGENTS.md placeholders below.
TIER_RULES=""
TIER_CAPABILITIES=""
case "$TIER" in
  free)
    TIER_RULES="You do not write or execute code. You do not spawn sub-agents. If asked, explain the tier boundary politely."
    TIER_CAPABILITIES=$'## Tier Capabilities\n- **No code execution** — You cannot write or execute code\n- **No sub-agents** — You handle tasks directly\n- **Web tools available** — search, fetch, read'
    ;;
  premium)
    TIER_RULES="You can spawn sub-agents for complex tasks. You do not write or execute shell commands directly."
    TIER_CAPABILITIES=$'## Tier Capabilities\n- **Sub-agents** — You can spawn sub-agents for complex tasks\n- **Browser, Canvas & Nodes** — Full automation\n- **No direct code execution**'
    ;;
  enterprise)
    TIER_RULES="Full capabilities available. You can write and execute code, spawn sub-agents, and use all tools."
    TIER_CAPABILITIES=$'## Tier Capabilities\n- **Full capabilities** — Code execution, sub-agents, all tools available'
    ;;
  *)
    echo "[openclaw-entrypoint] unknown tier '${TIER}'" >&2
    exit 1
    ;;
esac

# Portable placeholder substitution. Each placeholder lives on its own line in
# the templates; we delete that line and `r`-read the replacement from a temp
# file. This avoids the `s///`-with-`\n` portability trap (GNU vs BSD sed
# differ on whether `\n` in the replacement becomes a newline) and avoids the
# `-v` newline restriction in BSD awk. `r` and `d` are POSIX sed commands and
# behave identically on GNU and BSD sed.
#
# The `marker` argument is a substring unique to that placeholder line — kept
# simple to avoid regex-escaping. The rest of the line is irrelevant; the whole
# placeholder line is replaced by `replacement_text`.
substitute_placeholder_line() {
  local file="$1" marker="$2" replacement_text="$3"
  if [ ! -f "$file" ]; then
    return 0
  fi
  if ! grep -qF "$marker" "$file" 2>/dev/null; then
    return 0
  fi
  local repl_file
  repl_file=$(mktemp)
  printf '%s\n' "$replacement_text" > "$repl_file"
  sed -i "/${marker}/{
    r ${repl_file}
    d
  }" "$file"
  rm -f "$repl_file"
}

TIER_RULES_BLOCK=$'## Tier Rules\n'"$TIER_RULES"
substitute_placeholder_line "$WORKSPACE/SOUL.md" "TIER_RULES_PLACEHOLDER" "$TIER_RULES_BLOCK"
substitute_placeholder_line "$WORKSPACE/AGENTS.md" "TIER_CAPABILITIES_PLACEHOLDER" "$TIER_CAPABILITIES"

mkdir -p "$WORKSPACE/memory" "$WORKSPACE/projects"

# Symlink workspace config to where openclaw looks for it (~/.openclaw/openclaw.json).
# TODO(hardening): templates use dangerouslyAllowHostHeaderOriginFallback=true for dev;
#   production containers should set gateway.controlUi.allowedOrigins to explicit origins instead.
mkdir -p /root/.openclaw
ln -sf "$WORKSPACE/openclaw.json" /root/.openclaw/openclaw.json

echo "[openclaw-entrypoint] workspace ready (tier=${TIER}); exec: $*"
exec "$@"
