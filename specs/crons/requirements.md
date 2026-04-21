# Crons & Schedules — Requirements

## User Stories

### US-C1: View my schedules

**As a** user  
**I want** to see all my automated schedules and their status  
**So that** I know what Axel is doing on a recurring basis

**Acceptance Criteria:**

- [ ] Schedules page shows all user schedules from API
- [ ] Each schedule shows: name, frequency description, last run status, next run time
- [ ] Enabled/disabled state clearly visible (toggle)
- [ ] Loading skeleton while fetching
- [ ] Empty state with CTA to create first schedule

### US-C2: Create a schedule

**As a** user  
**I want** to create a new recurring task for Axel  
**So that** work happens automatically without me asking

**Acceptance Criteria:**

- [ ] "New schedule" button opens create modal
- [ ] User provides: name, description (what Axel should do), frequency, time, timezone
- [ ] Friendly preset selectors for common frequencies (daily, weekday, weekly, hourly)
- [ ] Advanced option for raw cron expression
- [ ] Created schedule appears in list immediately
- [ ] Schedule propagated to OpenClaw workspace

### US-C3: Edit a schedule

**As a** user  
**I want** to change the frequency or description of a schedule  
**So that** I can adjust automations as my needs change

**Acceptance Criteria:**

- [ ] "Edit" button opens pre-filled edit modal
- [ ] All fields editable: name, description, frequency, time, timezone
- [ ] Changes saved and propagated to workspace
- [ ] Next run time recalculated

### US-C4: Enable/disable a schedule

**As a** user  
**I want** to pause a schedule without deleting it  
**So that** I can temporarily stop an automation

**Acceptance Criteria:**

- [ ] Toggle switch enables/disables schedule
- [ ] Disabled schedules shown dimmed with "Paused" indicator
- [ ] Disabled schedules do not execute
- [ ] Re-enabling recalculates next run time

### US-C5: Delete a schedule

**As a** user  
**I want** to permanently remove a schedule  
**So that** Axel stops running it

**Acceptance Criteria:**

- [ ] Delete option in menu (⋮) with confirmation prompt
- [ ] Schedule removed from DB and workspace
- [ ] Past task history from this schedule is preserved (not deleted)

### US-C6: Run a schedule immediately

**As a** user  
**I want** to trigger a schedule right now  
**So that** I can test it or get an immediate result

**Acceptance Criteria:**

- [ ] "Run now" button triggers immediate execution
- [ ] Creates a task visible in the Tasks page
- [ ] Schedule card updates last_run_at and status
- [ ] Does not affect the next scheduled run time

### US-C7: Schedule execution visibility

**As a** user  
**I want** to see the history of a schedule's executions  
**So that** I can verify it's working correctly

**Acceptance Criteria:**

- [ ] Last run shows status (success/failed) with link to task
- [ ] Failed runs show clear error indicator
- [ ] Clicking "View history" shows related tasks from Tasks page (filtered)
