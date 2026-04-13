# Workspace Config Sync — Requirements

## User Stories

### US-WS1: Integration changes take effect

**As a** user who just connected an integration  
**I want** Axel to start using it immediately  
**So that** I don't have to wait or restart anything

**Acceptance Criteria:**

- [ ] When an integration is connected, workspace files are updated within seconds
- [ ] Container is signalled to reload config
- [ ] If reload fails, config catches up on next OpenClaw heartbeat (< 30 min)
- [ ] User sees "Connected" status in the UI regardless of reload timing

### US-WS2: Schedule changes take effect

**As a** user who created a new schedule  
**I want** Axel to start running it on time  
**So that** my automation works as expected

**Acceptance Criteria:**

- [ ] HEARTBEAT.md updated with new schedule immediately after creation
- [ ] Container signalled to reload
- [ ] Schedule runs on next cron trigger (not dependent on reload success)

### US-WS3: BYOM changes take effect

**As a** Premium user who provided my own model API key  
**I want** Axel to use my model immediately  
**So that** I get my preferred model without delay

**Acceptance Criteria:**

- [ ] openclaw.json updated with user's model config
- [ ] Container signalled to reload
- [ ] Next chat message uses the new model
- [ ] If BYOM key is removed, reverts to platform default model

### US-WS4: Tier change updates agent capabilities

**As a** user who upgrades from Free to Premium  
**I want** my agent's capabilities to expand immediately  
**So that** I get what I'm paying for

**Acceptance Criteria:**

- [ ] SOUL.md, AGENTS.md, openclaw.json updated with premium tier rules/config
- [ ] Container signalled to reload
- [ ] Agent uses stronger model and has expanded permissions
- [ ] Downgrade: capabilities restricted immediately

### US-WS5: Credentials are secure in workspace files

**As a** security-conscious user  
**I want** my API keys to be protected even in the workspace  
**So that** they can't be easily exfiltrated

**Acceptance Criteria:**

- [ ] Credentials decrypted only when writing to workspace (not held in memory)
- [ ] Workspace is on encrypted EFS (at-rest encryption)
- [ ] Credentials in openclaw.json are not logged by the config sync service
- [ ] If decryption fails, partial config is written (without the broken credential)
- [ ] TOOLS.md shows integration status but never credential values

### US-WS6: Resilient to failures

**As the** platform  
**I want** config sync to degrade gracefully  
**So that** one failure doesn't break the user's experience

**Acceptance Criteria:**

- [ ] EFS write failure: logged, user sees success (config catches up later)
- [ ] Reload failure: logged, OpenClaw reads on next heartbeat
- [ ] Container offline: files written, read on next container startup
- [ ] Decryption failure: credential skipped, partial config written, logged for alert
