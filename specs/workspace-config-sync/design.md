# Workspace Config Sync — Design

## Overview

Multiple features need to write to a user's OpenClaw workspace after initial onboarding:

- **Integrations** — update TOOLS.md + openclaw.json when credentials change
- **BYOM** — update openclaw.json model config when user provides their own API key
- **Schedules** — update HEARTBEAT.md when crons are created/changed
- **Tier change** — update openclaw.json + SOUL.md + AGENTS.md when user upgrades/downgrades

This spec defines the **single mechanism** for writing config to a running container and triggering a reload.

## Problem

The workspace generator (`workspaceGenerator.ts`) runs once at onboarding completion. It writes files to `${WORKSPACE_PATH}/${userId}/workspace`. After that, the container is running and reading those files. Post-onboarding changes need a way to:

1. **Write updated files** to the workspace path
2. **Signal the container** to re-read them

## Architecture

```
Feature handler (integrations, BYOM, crons, etc.)
  → Calls WorkspaceConfigService.updateFiles(userId, files)
    → 1. Writes files to EFS workspace path
    → 2. Calls gateway /api/reload (fire-and-forget)
```

### Write Path

```
Production:  EFS mount → /efs/{userId}/workspace/{filename}
Development: /tmp/workspace/{userId}/workspace/{filename}
```

The backend Lambda/service has write access to the same EFS volume that the container reads from. This is the simplest path — no intermediate storage, no message queue.

**If EFS is not accessible from Lambda** (architecture constraint), the fallback is:

- Backend calls `POST /api/config` on the gateway with file contents in the body
- Gateway writes files to its local workspace
- This adds complexity but avoids EFS-from-Lambda

**Decision needed from Ferenc:** Can the Lambda backend write to the same EFS mount the container reads? This determines the write strategy.

### Reload Signal

After writing files, call the gateway's reload endpoint (defined in gateway-contract spec):

```typescript
await triggerConfigReload(gatewayUrl, reason, changedFiles);
```

This is fire-and-forget. If it fails, OpenClaw picks up changes on the next heartbeat (2-4x/day).

## WorkspaceConfigService

Central service that all features call when they need to update workspace config.

```typescript
// microservices/core/src/application/workspace/workspaceConfigService.ts

interface FileUpdate {
  filename: string; // e.g. "TOOLS.md", "openclaw.json", "HEARTBEAT.md"
  content: string; // Full file content (not a diff)
}

export class WorkspaceConfigService {
  async updateFiles(
    userId: string,
    updates: FileUpdate[],
    reason: string,
  ): Promise<void> {
    // 1. Resolve workspace path
    const workspacePath = resolveWorkspacePath(userId);

    // 2. Write files to EFS (or /tmp in dev)
    await Promise.all(
      updates.map(({ filename, content }) =>
        fs.writeFile(path.join(workspacePath, filename), content, "utf-8"),
      ),
    );

    // 3. Signal container to reload (fire-and-forget)
    const container = await provisioningRepo.getContainerByUserId(userId);
    if (container?.gatewayUrl && container.status === "active") {
      await triggerConfigReload(
        container.gatewayUrl,
        reason,
        updates.map((u) => u.filename),
      );
    }
    // If container not active, files will be read on next startup
  }
}
```

## File Generators

Each feature is responsible for generating the file content. The service just writes and signals.

### TOOLS.md Generator

Called when integrations change.

```markdown
# TOOLS.md

## Channels

- **Telegram** — Connected (bot token configured)
- **Gmail** — Connected (OAuth, read + send)
- **WebChat** — Built-in (always available)

## Integrations

- **Google Calendar** — Connected (OAuth, read + write)
- **Notion** — Connected (API key)

## AI Models

- **Platform default** — anthropic/haiku (Free tier)
```

### openclaw.json Generator

Called when integrations, BYOM, or tier changes.

Must merge with the base tier config (openclaw-free.json or openclaw-premium.json) and add:

- Channel configs for connected communication channels
- Skill configs for connected tool integrations
- Model overrides for BYOM

```json
{
  "gateway": {
    "mode": "local",
    "bind": "lan",
    "port": 18789
  },
  "agents": {
    "defaults": {
      "workspace": "/data/workspace",
      "model": {
        "primary": "anthropic/haiku"
      }
    }
  },
  "channels": {
    "telegram": {
      "adapter": "telegram",
      "botToken": "${TELEGRAM_BOT_TOKEN}"
    }
  },
  "skills": {
    "notion": {
      "type": "stdio",
      "command": "openclaw-skill-notion",
      "env": {
        "NOTION_API_KEY": "${NOTION_API_KEY}"
      }
    }
  }
}
```

**Important:** Credential values in openclaw.json must be **decrypted** before writing. The workspace is on encrypted EFS storage, so the file itself is encrypted at rest by AWS. But the JSON content contains plaintext credentials because OpenClaw needs to read them directly.

### HEARTBEAT.md Generator

Called when schedules change.

```markdown
# HEARTBEAT.md

## Scheduled Tasks

- **Daily email digest** (every day at 09:00 Europe/London): Check inbox and send a summary of important emails
- **Weekly report** (every Monday at 14:00 Europe/London): Generate and send the weekly activity report

## Standing Instructions

- Reply HEARTBEAT_OK when nothing needs attention
- Check in 2-4x/day max
- Stay quiet 23:00–08:00 unless urgent
```

### SOUL.md / AGENTS.md Updaters

Called when tier changes (upgrade/downgrade). Re-inject tier-specific rules using the same placeholder logic from `docker-entrypoint.sh`, but applied post-onboarding.

## Credential Decryption

When generating `openclaw.json`, credentials must be decrypted from the `integration_credentials` table:

```typescript
async function buildOpenClawConfig(
  userId: string,
  tier: string,
): Promise<string> {
  const credentials = await integrationRepo.findByUserId(userId);
  const baseConfig = loadTierConfig(tier); // openclaw-free.json or openclaw-premium.json

  for (const cred of credentials) {
    const plaintext = decrypt(cred.encryptedValue, cred.iv, encryptionKey);
    // Add to config based on integration type
    addToConfig(baseConfig, cred.integrationId, plaintext);
  }

  return JSON.stringify(baseConfig, null, 2);
}
```

## When Each File is Updated

| Trigger                            | Files Updated                     | Reason              |
| ---------------------------------- | --------------------------------- | ------------------- |
| Integration connected/disconnected | TOOLS.md, openclaw.json           | integration_changed |
| BYOM key added/removed             | TOOLS.md, openclaw.json           | byom_changed        |
| Schedule created/updated/deleted   | HEARTBEAT.md                      | schedule_changed    |
| Tier upgraded/downgraded           | SOUL.md, AGENTS.md, openclaw.json | tier_changed        |
| Onboarding complete (initial)      | All files                         | onboarding_complete |

## Failure Modes

| Failure               | Impact                           | Recovery                                                                                         |
| --------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| EFS write fails       | Config not updated               | Retry once, then log error. User sees "Integration connected" but agent doesn't have it yet.     |
| Reload endpoint fails | Container running stale config   | OpenClaw reads files on next heartbeat (2-4x/day). No user action needed.                        |
| Container not running | Files written but not read       | Container reads on next startup.                                                                 |
| Decryption fails      | Can't write credential to config | Log error, skip this credential, write partial config. Alert user that integration may not work. |
