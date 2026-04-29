#!/bin/bash
set -euo pipefail

# OpenClaw container entrypoint.
#
# Env vars (all optional in Phase 1; required for Phase 5 ECS task overrides):
#   AXEL_USER_ID         Stable Axel user ID (used for log correlation).
#   AXEL_SESSION_ID      Unique per task launch (used for log correlation).
#   AXEL_SESSION_NAME    Caller-supplied subdomain name (informational only here).
#   AXEL_TIER            Subscription tier — one of: starter, pro, business, developer.
#                        Falls back to TIER for backwards compatibility with the
#                        legacy docker/user-container/ entrypoint.
#
# Workspace path is fixed to /data/workspace because the OpenClaw config files in
# workspace-templates/ hardcode that path. Do not change without updating those.

WORKSPACE=/data/workspace
TEMPLATES=/data/workspace-templates

# AXEL_TIER takes precedence; TIER kept for compatibility with the legacy image.
TIER="${AXEL_TIER:-${TIER:-starter}}"

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

# Inject tier rules into SOUL.md (only on first boot — guarded by placeholder presence).
TIER_RULES=""
case "$TIER" in
  starter)
    TIER_RULES="You do not write or execute code. You do not spawn sub-agents. If asked, explain the tier boundary politely."
    ;;
  pro|business)
    TIER_RULES="You can spawn sub-agents for complex tasks. You do not write or execute shell commands directly."
    ;;
  developer)
    TIER_RULES="Full capabilities available. You can write and execute code, spawn sub-agents, and use all tools."
    ;;
  *)
    echo "[openclaw-entrypoint] unknown tier '${TIER}'" >&2
    exit 1
    ;;
esac

if grep -q "\[TIER_RULES_PLACEHOLDER\]" "$WORKSPACE/SOUL.md" 2>/dev/null; then
  sed -i "s/\[TIER_RULES_PLACEHOLDER\]/## Tier Rules\n$TIER_RULES/" "$WORKSPACE/SOUL.md"
fi

TIER_CAPABILITIES=""
case "$TIER" in
  starter)
    TIER_CAPABILITIES="## Tier Capabilities\n- **No code execution** — You cannot write or execute code\n- **No sub-agents** — You handle tasks directly\n- **Web tools available** — search, fetch, read"
    ;;
  pro)
    TIER_CAPABILITIES="## Tier Capabilities\n- **Sub-agents** — You can spawn sub-agents for complex tasks\n- **Browser & Canvas** — Limited automation\n- **No direct code execution**"
    ;;
  business)
    TIER_CAPABILITIES="## Tier Capabilities\n- **Sub-agents** — You can spawn sub-agents for complex tasks\n- **Browser, Canvas & Nodes** — Full automation\n- **No direct code execution**"
    ;;
  developer)
    TIER_CAPABILITIES="## Tier Capabilities\n- **Full capabilities** — Code execution, sub-agents, all tools available"
    ;;
esac

if grep -q "\[TIER_CAPABILITIES_PLACEHOLDER\]" "$WORKSPACE/AGENTS.md" 2>/dev/null; then
  sed -i "s/\[TIER_CAPABILITIES_PLACEHOLDER\]/$TIER_CAPABILITIES/" "$WORKSPACE/AGENTS.md"
fi

mkdir -p "$WORKSPACE/memory" "$WORKSPACE/projects"

# Symlink workspace config to where openclaw looks for it (~/.openclaw/openclaw.json).
# TODO(hardening): templates use dangerouslyAllowHostHeaderOriginFallback=true for dev;
#   production containers should set gateway.controlUi.allowedOrigins to explicit origins instead.
mkdir -p /root/.openclaw
ln -sf "$WORKSPACE/openclaw.json" /root/.openclaw/openclaw.json

echo "[openclaw-entrypoint] workspace ready (tier=${TIER}); exec: $*"
exec "$@"
