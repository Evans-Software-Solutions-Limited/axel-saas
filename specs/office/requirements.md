# Office (Agent Visualisation) — Requirements

## User Stories

### US-O1: See my agents and their status

**As a** user  
**I want** to see which agents are working for me and what they're doing  
**So that** I have visibility into my AI team's activity

**Acceptance Criteria:**

- [ ] Office page shows agents that are active for this user (not a fixed list)
- [ ] Each agent shows real-time status: idle, busy, or working
- [ ] Busy/working agents show what task they're currently on
- [ ] Status updates within 10 seconds via polling
- [ ] Axel (primary agent) is always shown

### US-O2: Desk view with pixel art

**As a** user  
**I want** to see my agents in a visual office scene  
**So that** the experience feels engaging and distinct

**Acceptance Criteria:**

- [ ] Pixel art background with agents at desks (existing asset)
- [ ] Agent sprites positioned dynamically based on active agent count
- [ ] Hover over agent shows tooltip with name, role, current task, last active
- [ ] Click agent switches to list view with that agent expanded
- [ ] Status glow effects on busy/working agents (existing styling)

### US-O3: List view with task history

**As a** user  
**I want** to see detailed stats and recent work per agent  
**So that** I can understand what each agent has accomplished

**Acceptance Criteria:**

- [ ] Accordion list shows each agent with stats (total tasks, today's tasks, avg duration)
- [ ] Expanding an agent shows recent task list with status badges
- [ ] Tasks link to task detail (or expand inline)
- [ ] Stats computed from real task event data

### US-O4: Empty state

**As a** new user who just completed onboarding  
**I want** to see a helpful empty state  
**So that** I know what to do next

**Acceptance Criteria:**

- [ ] When no tasks exist, show Axel alone in the office
- [ ] Friendly message: "Axel is ready. Start a conversation to put your assistant to work."
- [ ] Clear CTA button linking to chat
- [ ] No broken UI or "undefined" when there's no data

### US-O5: Quick Chat from office

**As a** user  
**I want** to quickly message Axel from the office view  
**So that** I don't have to navigate away

**Acceptance Criteria:**

- [ ] "Quick Chat" button in office (already exists in UI)
- [ ] Opens chat interface (navigate to /dashboard/chat or open panel)
