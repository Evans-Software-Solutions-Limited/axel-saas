# Tasks — Requirements

## User Stories

### US-TK1: View all tasks
**As a** user  
**I want** to see everything my agents have worked on  
**So that** I can track what's been done and what's in progress

**Acceptance Criteria:**
- [ ] Tasks page shows real data from `/users/me/tasks` API
- [ ] Each task shows: summary, agent name, status badge, relative timestamp
- [ ] Tasks ordered by most recent first
- [ ] Loading skeleton shown while fetching
- [ ] Empty state with CTA to chat when no tasks exist

### US-TK2: Filter and search tasks
**As a** user  
**I want** to filter tasks by status and agent, and search by name  
**So that** I can find specific tasks quickly

**Acceptance Criteria:**
- [ ] Text search filters tasks by summary content
- [ ] Status dropdown filters by: All, In Progress, Completed, Failed, Review Ready
- [ ] Agent dropdown filters by source agent
- [ ] Filters combine (search AND status AND agent)
- [ ] "No results" state when filters match nothing

### US-TK3: View task detail
**As a** user  
**I want** to see the full detail of a task including its event timeline  
**So that** I understand what happened during execution

**Acceptance Criteria:**
- [ ] Click a task row to expand it inline
- [ ] Expanded view shows: full summary, event timeline, duration, source agent
- [ ] Event timeline shows each event with timestamp and type
- [ ] Repo/branch shown if applicable
- [ ] Close/collapse to return to table view

### US-TK4: Live task updates
**As a** user  
**I want** in-progress tasks to update automatically  
**So that** I see real-time progress without refreshing

**Acceptance Criteria:**
- [ ] Tasks poll every 10 seconds while page is visible
- [ ] Status badges update when task state changes
- [ ] New tasks appear at the top of the list
- [ ] Polling stops when all visible tasks are in terminal state
- [ ] No visual flicker on poll updates
