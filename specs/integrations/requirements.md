# Integrations & Credential Management — Requirements

## User Stories

### US-I1: View available integrations
**As a** user  
**I want** to see all integrations Axel supports and which ones I've connected  
**So that** I know what tools I can use with my assistant

**Acceptance Criteria:**
- [ ] Integrations page shows categorised list: Communication, Tools, AI Models
- [ ] Each integration shows name, icon, description, connection status
- [ ] Connected integrations show green status dot and connected date
- [ ] Tier-locked integrations show lock icon and "Upgrade" CTA
- [ ] Post-MVP integrations show "Coming soon" badge

### US-I2: Connect via API key
**As a** user  
**I want** to securely provide an API key or bot token to connect an integration  
**So that** Axel can use that service on my behalf

**Acceptance Criteria:**
- [ ] Click "Connect" opens a modal with clear instructions on how to get the credential
- [ ] Input field masks the value (password type)
- [ ] Submit encrypts and stores the credential server-side
- [ ] Frontend never sees the full credential again after submission
- [ ] After connecting, card shows "Connected" with masked hint (e.g. `bot123...xxxx`)
- [ ] Connection propagates to OpenClaw workspace config
- [ ] Error state shown if credential is invalid format

### US-I3: Connect via OAuth
**As a** user  
**I want** to connect Gmail/Calendar/Slack via a standard OAuth flow  
**So that** I don't have to manually copy tokens

**Acceptance Criteria:**
- [ ] Click "Connect" redirects to provider's consent screen
- [ ] After granting access, user is redirected back to integrations page
- [ ] Integration shows as "Connected" immediately
- [ ] OAuth tokens stored encrypted server-side
- [ ] Refresh token rotation handled automatically
- [ ] If OAuth fails, user sees clear error with retry option

### US-I4: Disconnect an integration
**As a** user  
**I want** to revoke an integration connection  
**So that** Axel stops using that service

**Acceptance Criteria:**
- [ ] "Manage" → "Disconnect" button with confirmation prompt
- [ ] Credential hard-deleted from database
- [ ] Integration removed from OpenClaw workspace config
- [ ] Card reverts to "Not connected" state
- [ ] Agent stops using the service (no stale config)

### US-I5: Update a credential
**As a** user  
**I want** to update a credential (e.g. rotated API key)  
**So that** Axel continues working after I rotate my keys

**Acceptance Criteria:**
- [ ] "Manage" → "Update" opens the connect modal pre-labelled
- [ ] New credential replaces old one (encrypted)
- [ ] Workspace config updated with new credential
- [ ] Connection status refreshed

### US-I6: Credential security
**As a** user  
**I want** my credentials stored securely  
**So that** my API keys and tokens are protected

**Acceptance Criteria:**
- [ ] Credentials encrypted with AES-256-GCM at rest
- [ ] Unique IV per credential
- [ ] Full credential never returned in any API response
- [ ] Full credential never appears in logs
- [ ] Credentials transmitted over HTTPS only
- [ ] Hard delete on disconnect (no soft delete / tombstone)

### US-I7: BYOM (Bring Your Own Model) — Premium
**As a** Premium user  
**I want** to provide my own AI model API key  
**So that** Axel uses my preferred model provider

**Acceptance Criteria:**
- [ ] BYOM section visible only to Premium users
- [ ] Free users see "Upgrade to Premium" prompt
- [ ] Supported providers: OpenAI, Anthropic (MVP)
- [ ] After connecting, user's OpenClaw config updated with their model key
- [ ] User can choose which model to use (dropdown of provider's models)
- [ ] If BYOM key is invalid/exhausted, graceful fallback to platform models with notification

### US-I8: Integration help text
**As a** non-technical user  
**I want** clear instructions on how to get each credential  
**So that** I can connect my tools without developer knowledge

**Acceptance Criteria:**
- [ ] Each integration has a help link or inline guide
- [ ] Telegram: step-by-step @BotFather instructions
- [ ] Notion: how to create an internal integration
- [ ] Gmail/Calendar/Slack: "Click Connect and follow the prompts"
- [ ] Help text is concise (not a full tutorial — link out for detail)
