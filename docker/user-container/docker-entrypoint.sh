#!/bin/bash
set -e

WORKSPACE=/data/workspace
TEMPLATES=/data/workspace-templates
TIER="${TIER:-starter}"

# On first boot: copy template files to workspace volume
for f in SOUL.md USER.md MEMORY.md AGENTS.md TOOLS.md HEARTBEAT.md; do
  if [ ! -f "$WORKSPACE/$f" ]; then
    echo "First boot: copying template $f"
    cp "$TEMPLATES/$f" "$WORKSPACE/$f"
  fi
done

# Copy tier-appropriate openclaw.json if not present
if [ ! -f "$WORKSPACE/openclaw.json" ]; then
  echo "First boot: copying tier config ($TIER)"
  cp "$TEMPLATES/openclaw-${TIER}.json" "$WORKSPACE/openclaw.json"
fi

# Inject tier rules into SOUL.md
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
esac

sed -i "s/\[TIER_RULES_PLACEHOLDER\]/## Tier Rules\n$TIER_RULES/" "$WORKSPACE/SOUL.md"

# Inject tier capabilities into AGENTS.md
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

sed -i "s/\[TIER_CAPABILITIES_PLACEHOLDER\]/$TIER_CAPABILITIES/" "$WORKSPACE/AGENTS.md"

# Create required directories
mkdir -p "$WORKSPACE/memory" "$WORKSPACE/projects"

# Symlink workspace config to where openclaw looks for it (~/.openclaw/openclaw.json)
# TODO(hardening): templates use dangerouslyAllowHostHeaderOriginFallback=true for dev;
#   production containers should set gateway.controlUi.allowedOrigins to explicit origins instead.
mkdir -p /root/.openclaw
ln -sf "$WORKSPACE/openclaw.json" /root/.openclaw/openclaw.json

echo "Workspace ready (tier: $TIER)"
exec "$@"
