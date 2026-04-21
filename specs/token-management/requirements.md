# Token Management & Cost Control — Requirements

## User Stories

### US-TM1: Free tier daily usage cap

**As a** Free tier user  
**I want** a clear daily usage limit  
**So that** I can use Axel within the free allowance

**Acceptance Criteria:**

- [ ] Free tier has a defined daily token budget (input + output)
- [ ] Usage tracked per user per day
- [ ] When limit reached: chat returns 429 with friendly message
- [ ] Message includes: when it resets, upgrade CTA
- [ ] Scheduled tasks deferred when limit reached (not silently dropped)
- [ ] Limit resets at midnight UTC

### US-TM2: See my usage

**As a** user  
**I want** to see how much of my allowance I've used  
**So that** I can pace my usage or decide to upgrade

**Acceptance Criteria:**

- [ ] Free tier: usage bar visible in dashboard (sidebar or header)
- [ ] Shows percentage used + remaining
- [ ] Premium tier: usage visible in Settings → Billing
- [ ] Usage includes: tokens used today/this month, estimated cost (BYOM only)

### US-TM3: Premium tier monthly budget

**As a** Premium user  
**I want** generous monthly usage that justifies my subscription  
**So that** I can use Axel all day without worrying

**Acceptance Criteria:**

- [ ] Premium tier has monthly token budget (much higher than free daily)
- [ ] Warning at 80% monthly usage
- [ ] Hard cap at 100% with message
- [ ] No daily limit for Premium (only monthly)

### US-TM4: Model routing by tier

**As the** platform  
**I want** Free tier to use cheaper models and Premium to use stronger ones  
**So that** we maintain healthy margins

**Acceptance Criteria:**

- [ ] Free tier defaults to `anthropic/haiku` (cheap)
- [ ] Premium tier defaults to `anthropic/sonnet` (stronger)
- [ ] Background/prep tasks use cheap models even on Premium
- [ ] Trust-critical tasks use premium models
- [ ] Model config set in OpenClaw workspace config per tier

### US-TM5: BYOM (Bring Your Own Model)

**As a** Premium user who provides my own API key  
**I want** Axel to use my model provider  
**So that** I get my preferred model and pay directly

**Acceptance Criteria:**

- [ ] When BYOM key is set (via Integrations), OpenClaw config updated to use it
- [ ] No platform token caps applied (user pays their own provider)
- [ ] Usage still tracked for visibility (but no enforcement)
- [ ] If BYOM key fails (invalid/exhausted), fallback to platform model with notification
- [ ] User can see their token usage and estimated cost in settings

### US-TM6: Rate limit feedback in chat

**As a** user who hits a rate limit  
**I want** a clear, non-technical message  
**So that** I understand what happened and what to do

**Acceptance Criteria:**

- [ ] Chat shows inline message (not a browser error)
- [ ] Message explains: limit type (daily/monthly), when it resets, how to get more
- [ ] Free tier message includes upgrade CTA
- [ ] Premium tier message is empathetic (no aggressive upsell)
- [ ] Message styled consistently with chat UI

### US-TM7: Usage history

**As a** user  
**I want** to see my usage over time  
**So that** I can understand my patterns

**Acceptance Criteria:**

- [ ] Daily usage chart in Settings (last 7 or 30 days)
- [ ] Shows input + output tokens per day
- [ ] BYOM users also see estimated cost per day
- [ ] Simple bar chart or sparkline (not overly complex)
