# Authenticated Rate Limiting — Requirements

## User Stories

### US-RL1: Protect expensive endpoints from burst abuse
**As the** platform  
**I want** rate limits on authenticated endpoints  
**So that** one user can't exhaust resources or run up costs

**Acceptance Criteria:**
- [ ] Chat endpoint limited to 10 req/min per user
- [ ] Write endpoints (integrations, schedules) limited to 5-10 req/min
- [ ] Read endpoints limited to 60 req/min
- [ ] Stripe webhook has no rate limit (Stripe controls this)
- [ ] Limits applied per authenticated user ID

### US-RL2: Clear rate limit feedback
**As a** user who gets rate-limited  
**I want** a clear message telling me to wait  
**So that** I know it's temporary and not a bug

**Acceptance Criteria:**
- [ ] 429 response with JSON body: error code, message, retryAfter seconds
- [ ] Standard headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
- [ ] Chat: inline message "Slow down — Axel needs a moment"
- [ ] Other endpoints: toast notification in frontend
- [ ] No browser error pages

### US-RL3: Global IP-based protection
**As the** platform  
**I want** a global rate limit per IP  
**So that** unauthenticated abuse is also limited

**Acceptance Criteria:**
- [ ] 100 req/min per IP across all endpoints
- [ ] Applied before authentication (catches invalid-token floods)
- [ ] Doesn't interfere with legitimate multi-user IPs (office buildings)

### US-RL4: Rate limiting doesn't break normal use
**As a** normal user  
**I want** rate limits to be generous enough that I never hit them  
**So that** the product feels responsive

**Acceptance Criteria:**
- [ ] 10 chat messages/min is sufficient for conversational use (1 every 6 seconds)
- [ ] 60 reads/min is sufficient for page navigation and polling
- [ ] Write limits don't block normal form submissions
- [ ] Rate limit resets promptly (1-minute windows)
