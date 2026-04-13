# Workspace Config Sync — Tasks

## Core Service
- [ ] Create `microservices/core/src/application/workspace/workspaceConfigService.ts` — central file write + reload trigger
- [ ] Implement `updateFiles(userId, files[], reason)` — write to EFS + signal container
- [ ] Implement `resolveWorkspacePath(userId)` — reuse existing from provisioning service
- [ ] Integrate `triggerConfigReload()` from gateway client (gateway-contract spec)
- [ ] Add error handling: retry EFS write once, fire-and-forget reload, log all failures

## File Generators
- [ ] Create `microservices/core/src/application/workspace/toolsGenerator.ts` — generates TOOLS.md from integration credentials
- [ ] Create `microservices/core/src/application/workspace/openclawConfigGenerator.ts` — generates openclaw.json from tier config + integrations + BYOM
- [ ] Create `microservices/core/src/application/workspace/heartbeatGenerator.ts` — generates HEARTBEAT.md from schedules
- [ ] Create `microservices/core/src/application/workspace/tierConfigUpdater.ts` — updates SOUL.md + AGENTS.md for tier changes
- [ ] Each generator fetches its own data (credentials, schedules, tier) and produces file content

## OpenClaw Config Generation
- [ ] Load base tier config (openclaw-free.json or openclaw-premium.json)
- [ ] Merge channel configs from connected communication integrations
- [ ] Merge skill configs from connected tool integrations
- [ ] Override model config if BYOM is active
- [ ] Decrypt credentials from `integration_credentials` table for config values
- [ ] **Never log decrypted credentials**

## Integration Points
- [ ] After integration connect/disconnect → call `workspaceConfigService.updateFiles()` with TOOLS.md + openclaw.json
- [ ] After BYOM key added/removed → call with TOOLS.md + openclaw.json
- [ ] After schedule create/update/delete → call with HEARTBEAT.md
- [ ] After tier change (Stripe webhook or free provisioning) → call with SOUL.md + AGENTS.md + openclaw.json
- [ ] Wire these calls into the respective handlers (integrations, settings, crons, stripe)

## Coordinate with Ferenc
- [ ] Confirm EFS mount is accessible from Lambda (write path)
- [ ] If not: implement fallback `POST /api/config` endpoint on gateway for file push
- [ ] Confirm openclaw.json format for channels and skills
- [ ] Confirm HEARTBEAT.md is read by OpenClaw during heartbeat check-ins

## Tests
- [ ] Unit tests for each file generator (TOOLS.md, openclaw.json, HEARTBEAT.md)
- [ ] Unit tests for workspaceConfigService (write + reload, error handling)
- [ ] Test openclaw.json generation with: no integrations, 1 integration, multiple integrations, BYOM override
- [ ] Test HEARTBEAT.md with: no schedules, 1 schedule, multiple schedules, disabled schedules excluded
- [ ] Test credential decryption failure → partial config written
- [ ] Test container offline → files still written (no error thrown)

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
