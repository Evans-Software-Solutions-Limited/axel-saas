# Workspace Config Sync — Agent Instructions

## Context

After onboarding, the user's OpenClaw workspace files need to be updated whenever integrations, BYOM keys, schedules, or tier change. This spec creates a central service that writes files and signals the container to reload.

## Key Principle

**One service, many callers.** The `WorkspaceConfigService` is the only place that writes to the workspace. Feature handlers call it with generated file content. The service handles the write + reload.

## Key Files to Create

| File | Purpose |
|---|---|
| `microservices/core/src/application/workspace/workspaceConfigService.ts` | Central write + reload service |
| `microservices/core/src/application/workspace/toolsGenerator.ts` | TOOLS.md from integration state |
| `microservices/core/src/application/workspace/openclawConfigGenerator.ts` | openclaw.json from tier + integrations + BYOM |
| `microservices/core/src/application/workspace/heartbeatGenerator.ts` | HEARTBEAT.md from schedules |
| `microservices/core/src/application/workspace/tierConfigUpdater.ts` | SOUL.md + AGENTS.md tier rules |

## Key Files to Modify

| File | What to change |
|---|---|
| Integration handler (from integrations spec) | Call configService after connect/disconnect |
| Schedule handler (from crons spec) | Call configService after CRUD |
| Stripe webhook handler | Call configService after tier change |
| Settings handler | Call configService after tier change via cancel/upgrade |

## Existing Code to Reuse

- `workspaceGenerator.ts` — already generates files at onboarding. Extract the file writing logic (not the content generation) into the new service.
- `provisioningService.ts` → `resolveWorkspacePath()` — reuse for path resolution.
- `provisioningRepository.ts` → `getContainerByUserId()` — get gateway URL for reload.

## Rules

1. **Never block user-facing operations on config sync.** Write failures are logged, not thrown.
2. **Reload is fire-and-forget.** If it fails, OpenClaw picks up changes on next heartbeat.
3. **Decrypt credentials only at write time.** Don't hold plaintext in memory longer than needed.
4. **Never log credential values.** Log file names and integration IDs only.
5. **Write full file content, not diffs.** Each generator produces the complete file. This is simpler and avoids merge conflicts.
6. **One EFS write per file, parallelised.** Use `Promise.all` for multiple file writes.

## openclaw.json Merge Strategy

Start with the base tier config, then layer on:

```typescript
const config = JSON.parse(readFileSync(`openclaw-${tier}.json`));

// Add channels
for (const channel of connectedChannels) {
  config.channels ??= {};
  config.channels[channel.id] = channel.config;
}

// Add skills
for (const skill of connectedSkills) {
  config.skills ??= {};
  config.skills[skill.id] = skill.config;
}

// BYOM override
if (byomKey) {
  config.agents.defaults.model.primary = byomProvider;
}
```

**Do not modify the base tier config files.** Always start fresh from the template and layer on.

## Testing Notes

- Mock EFS (use tmp directory in tests)
- Mock gateway client (no real HTTP)
- Test file content generators independently (given state → expected markdown/JSON)
- Test service orchestration (generator called → files written → reload triggered)
- Test failure isolation (EFS fails → reload still attempted; reload fails → no error thrown)
- Coverage threshold: 90%
