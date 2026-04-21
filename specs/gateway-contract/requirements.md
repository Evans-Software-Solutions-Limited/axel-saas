# Gateway Contract — Requirements

## User Stories

### US-GW1: Chat message proxying

**As the** Axel SaaS backend  
**I want** a well-defined chat endpoint on the container gateway  
**So that** I can reliably proxy user messages and receive structured responses with usage data

**Acceptance Criteria:**

- [ ] Gateway exposes `POST /api/chat` accepting message, userId, optional sessionId
- [ ] Response includes `response` text, `messageId`, `sessionId`, and `usage` block
- [ ] Usage block contains: `inputTokens`, `outputTokens`, `model`, `cacheReadTokens`
- [ ] Errors return structured JSON with `error` code and `message`
- [ ] Backend forwards Authorization header and X-Request-Id for tracing
- [ ] 60-second timeout before backend gives up

### US-GW2: Token usage reporting

**As the** Axel SaaS backend  
**I want** accurate per-message token usage from the gateway  
**So that** I can track usage, enforce caps, and manage costs

**Acceptance Criteria:**

- [ ] Every successful `/api/chat` response includes a `usage` block
- [ ] `model` field reflects the actual model used (not just configured)
- [ ] Backend records usage in `token_usage` table from every response
- [ ] If usage block is missing, backend logs a warning but still returns the message to the user
- [ ] Optional: gateway can push usage batches via `POST /api/usage/report`

### US-GW3: Container health checking

**As the** Axel SaaS backend  
**I want** to check if a user's container is healthy  
**So that** I can report accurate agent status and trigger recovery

**Acceptance Criteria:**

- [ ] Gateway exposes `GET /api/health` returning status, agentReady, uptime
- [ ] 5-second timeout on health checks
- [ ] Backend uses this during provisioning polling (replaces or supplements current agent status check)
- [ ] Unhealthy response includes reason for debugging

### US-GW4: Config reload trigger

**As the** Axel SaaS backend  
**I want** to tell the container to reload its workspace config  
**So that** integration changes, BYOM updates, and schedule changes take effect without restarting

**Acceptance Criteria:**

- [ ] Gateway exposes `POST /api/reload` accepting reason and changed file list
- [ ] Container re-reads specified workspace files
- [ ] If agent is mid-task, reload is queued (not dropped)
- [ ] Backend does not block on reload success — it's fire-and-forget with logging
- [ ] Fallback: if reload endpoint doesn't exist, OpenClaw reads files on next heartbeat

### US-GW5: Container registration

**As a** newly provisioned container  
**I want** to register my gateway URL with the Axel SaaS backend  
**So that** the backend knows where to send requests

**Acceptance Criteria:**

- [ ] Container calls `POST /provisioning/register` on startup (already implemented)
- [ ] Authenticated via X-Provisioning-Secret header
- [ ] Backend marks provisioning as active and stores gateway URL
- [ ] Idempotent — calling register twice with same URL is a no-op

### US-GW6: Secure service-to-service communication

**As a** security-conscious platform  
**I want** all backend-to-container communication to be authenticated and encrypted  
**So that** user data is protected in transit

**Acceptance Criteria:**

- [ ] HTTPS required in production (HTTP allowed in dev only)
- [ ] Private IP addresses blocked for gateway URLs in production
- [ ] User JWT forwarded for chat requests (container can verify if needed)
- [ ] Shared secret used for container-to-backend calls
- [ ] No credentials logged in either direction
