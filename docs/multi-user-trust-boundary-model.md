# Multi-User Trust Boundary Model for B2B/Company Deployments

**Status:** Draft for discussion
**Authors:** Bradley, Ferenc
**Date:** 2026-03-23
**Audience:** Technical and semi-technical stakeholders

---

## 1. The Core Problem: Personal Trust vs. Organisational Trust

Today Axel operates in a personal-trust model. Each user gets their own provisioned workspace, their own conversation history, and their own subscription. The AI learns from and responds to one person. The trust boundary is simple: you are either the user, or you are not.

B2B deployments break this. A company buys Axel for 20 employees. Now the question is not just "is this person authenticated?" but:

- Can this employee read conversations their colleague had with Axel?
- Can the company admin see all threads, or only their own?
- If an employee leaves, what happens to the shared knowledge they contributed?
- Does Axel's memory of "Alice prefers bullet points" bleed into responses to "Bob"?
- Who owns the subscription — the user or the company?

These are fundamentally different problems. Getting them wrong has real consequences: data leakage between employees, privacy violations, inability to onboard/offboard cleanly, and billing confusion. The current schema (`users → subscriptions → provisioningState`) is entirely user-centric and has no concept of organisational membership. A B2B model requires a new layer between the subscription owner and the end user.

---

## 2. The Two Contexts: Personal vs. Company

Every interaction Axel has lives in one of two contexts. These must be kept strictly separate.

### Personal Context

- Belongs to a single user
- Contains: personal preferences, private tasks, individual conversation history, personal integrations (e.g. personal calendar, personal email)
- Visible only to that user
- Persists independent of employment status (if the user has a personal subscription)
- Examples: "Remind me to call my dentist", "Draft a message to my landlord"

### Company Context

- Belongs to the organisation, not the individual
- Contains: shared knowledge bases, company-wide templates, shared channel conversations, tool integrations tied to company accounts (e.g. company Slack, company GitHub)
- Visible to company admins (with appropriate scope — see §5)
- Examples: "Summarise our Q1 sprint", "Draft a company-wide announcement", messages in a shared team channel

**The key rule:** Company context is a tenant, not a user. Users are members of that tenant. A user leaving the company does not delete company context; it removes their access to it.

---

## 3. Session and Memory Isolation Model

### 3.1 Session Isolation

Each conversation session must be scoped to exactly one context — personal or company. Sessions cannot span both. The session initiator (user or shared channel) declares the context at creation time, and this cannot change mid-session.

```
Session
 ├── contextType: "personal" | "company"
 ├── contextId: userId | orgId
 ├── initiatedBy: userId
 └── messages: [...]
```

The AI must not carry memory or state across context boundaries within a single response. If a user asks Axel something in a company channel, Axel should not surface personal context (e.g. personal calendar events, private files) unless the user explicitly crosses into their personal context in a separate session.

### 3.2 Memory Isolation

Axel accumulates context over time: preferences, facts, prior decisions. In a multi-user model, there are three memory scopes:

| Scope              | Owner             | Visibility                             | Examples                                                     |
| ------------------ | ----------------- | -------------------------------------- | ------------------------------------------------------------ |
| Personal memory    | User              | User only                              | Communication style, personal preferences, private reminders |
| User-in-org memory | User (within org) | User + org admins (audit only)         | How this user works within company workflows                 |
| Org memory         | Organisation      | All org members (read), admins (write) | Company glossary, shared templates, team context             |

Memory from personal scope must never flow into org scope without explicit user action (e.g. "share this note with the team"). Org memory should not follow users when they leave the org.

### 3.3 Workspace Isolation

Currently `provisioningState` provisions one workspace per user (ECS task, workspace path, gateway URL). In a multi-user org model:

- Each **user** still gets a personal workspace (personal files, personal tooling)
- Each **org** gets a shared workspace (shared file store, shared tool integrations)
- A user session in company context mounts both: personal tooling available, but output/storage goes to org workspace unless explicitly personal

This does not require doubling ECS tasks. The personal workspace is a lightweight context overlay on top of the org workspace for company sessions. For personal sessions, only the personal workspace is mounted.

---

## 4. Permission Boundaries

There are three roles in a B2B deployment. Roles are org-scoped (a user can be an admin in one org and a member in another).

### Member

- Full access to personal context (read/write)
- Full access to their own conversations in company context
- Read access to shared org knowledge (templates, glossary)
- Can participate in shared channels
- Cannot see other members' individual conversations
- Cannot modify org-level memory or settings

### Admin

- Everything a Member can do
- Can view all member conversations within the org (audit log view — not live monitoring)
- Can manage org-level memory and templates
- Can invite/remove members
- Can configure org-wide integrations
- Cannot impersonate a member or read their personal context

### Billing Owner (may be same as Admin)

- Manages the org subscription (Stripe customer)
- Can see seat counts and usage aggregates
- Does not automatically have Admin conversation-audit rights (these should be explicitly granted)

**Hard limits:**

- No role can access personal context of another user, ever.
- Admins see org-context conversations in audit mode only — not in real-time and not as a surveillance tool.
- Admin access to conversation history should be logged (meta-audit trail).

---

## 5. Admin Visibility: What Admins Can and Cannot See

This is the most politically sensitive area. Getting the boundary wrong erodes employee trust.

### Admins CAN see

- All conversations that occurred in a company context (shared channels, org-scoped sessions)
- Who initiated a session and when (metadata)
- Usage statistics per user (message volume, feature usage) — aggregated, not verbatim
- Org memory contributions (who added what to the shared knowledge base)
- Integration activity for company-owned integrations

### Admins CANNOT see

- Personal context conversations (even if the user is on a company-funded seat)
- Personal memory, preferences, or private files
- Real-time conversation streams (audit access is always after-the-fact)
- Content from personal integrations (personal email, personal calendar)

**Disclosure requirement:** Users must be informed at onboarding which contexts are visible to admins. This is not optional — it builds trust and sets clear expectations. The UI should visually distinguish personal vs. company context at all times.

---

## 6. Group Chats and Shared Channels

Shared channels are the primary B2B collaboration primitive. A shared channel is a conversation context that multiple users can participate in, with Axel as a participant.

### Channel Properties

```
Channel
 ├── orgId: (owner)
 ├── name: string
 ├── members: userId[]
 ├── contextScope: "company" (always — shared channels are never personal)
 ├── memoryScope: "channel" | "org"  (does learning stay in this channel or org-wide?)
 ├── createdBy: userId
 └── archived: boolean
```

### Key Behaviours

- Axel maintains a channel-level thread. Participants see the full thread; Axel can reference prior messages.
- Axel should address responses to the specific user who sent a message, not generically to the group.
- Personal memory does not influence Axel's responses in a shared channel. Axel should treat all users consistently in org context to avoid revealing personal preferences.
- Channel transcripts are accessible to org admins under the same audit rules as other company-context sessions.

### Anti-pattern to avoid

Do not allow Axel to "bring in" personal context to answer a shared channel question. If user A asked Axel something privately yesterday and user B asks the same thing in a shared channel today, Axel should not reference the private conversation. It should answer from org memory only.

---

## 7. Onboarding and Provisioning Implications

The current onboarding flow is 1:1 (one user, one questionnaire, one provisioning). For B2B, there are two distinct onboarding flows.

### Org Onboarding (Admin flow)

1. Admin creates organisation (name, domain, billing)
2. Admin completes org-level questionnaire: company purpose, team structure, communication style, tool integrations
3. Org workspace is provisioned (shared ECS workspace, shared knowledge base)
4. Admin invites initial members (email/SSO)

### Member Onboarding (Employee flow)

1. Employee receives invite (email or SSO auto-provision via domain)
2. Employee completes a shorter personal questionnaire (individual preferences, role within the org)
3. Personal workspace is provisioned
4. Employee is linked to the org — they now have access to org context alongside personal context

### Schema implications

The current schema needs an `organisations` table and a `org_members` join table. `subscriptions` must support both user-owned (personal) and org-owned (B2B) billing. `provisioningState` must gain an `orgId` to support shared workspaces.

```
organisations
 ├── id
 ├── name
 ├── domain (for SSO auto-provisioning)
 ├── stripeCustomerId
 └── createdAt

org_members
 ├── orgId
 ├── userId
 ├── role: "admin" | "member"
 ├── joinedAt
 └── removedAt (soft delete for offboarding)
```

---

## 8. Employee Offboarding

Offboarding is as important as onboarding. Mishandling it causes data leakage and compliance issues.

### What happens when an employee leaves

| Data                                                       | Action                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Personal context (conversations, memory, files)            | Remains with the user, fully intact. Company has no access.              |
| Company-context conversations the employee participated in | Remain with the org. Employee loses access.                              |
| Org memory contributions from the employee                 | Remain with the org (they contributed to shared knowledge).              |
| Personal integrations                                      | Delinked from org context. Employee retains them personally.             |
| Company integrations                                       | Remain with org. Employee's access tokens are revoked.                   |
| Shared channel membership                                  | Employee is removed. Channel history is preserved for remaining members. |

### Offboarding steps (admin-initiated)

1. Admin removes employee from org (`org_members.removedAt` is set)
2. Employee's company-context sessions are terminated immediately
3. Company integrations: employee's delegated tokens are revoked
4. Employee's personal workspace remains intact and active (if they have a personal subscription or the company provided a seat they can convert)
5. Org is notified of seat reduction for billing purposes

### Hard rule

Offboarding must be instantaneous on the access side. Do not rely on token expiry or eventual consistency. The moment `removedAt` is set, auth middleware must deny company-context access for that user.

---

## 9. Recommended Default Architecture

For the initial B2B release, the following defaults are recommended to balance capability with implementation risk.

### Defaults

| Setting                               | Default                    | Rationale                            |
| ------------------------------------- | -------------------------- | ------------------------------------ |
| Personal context visibility to admins | Off, never                 | Trust-building, legal safety         |
| Shared channel memory scope           | Channel-only               | Safer; org-wide can be opted in      |
| Admin audit access                    | Explicit opt-in per admin  | Prevent accidental over-exposure     |
| SSO auto-provisioning                 | Optional (domain-verified) | Reduces friction, but must be opt-in |
| Personal workspace on company seat    | Yes, always                | Continuity if user leaves            |
| Shared workspace per org              | One shared, per org        | Start simple, shard later if needed  |
| Offboarding access revocation         | Synchronous, immediate     | No exceptions                        |

### Data model topology

```
User ─── personal context (workspace, memory, sessions)
 │
 └─── org_member ─── Organisation
                          │
                          ├── org context (workspace, memory, channels)
                          ├── channel sessions
                          └── subscription (Stripe, org-level)
```

The subscription owner for B2B is the org, not the user. Users are seats. A user may have both a personal subscription (separate) and an org seat — these are independent billing relationships.

---

## 10. Risks and Anti-Patterns

### Risk: Context bleed

**What:** Personal memory influencing company-context responses, or vice versa.
**Mitigation:** Hard session-level context scoping. AI prompt must include explicit context boundary instructions. Test with adversarial prompts that try to elicit personal context in org sessions.

### Risk: Admin overreach

**What:** Admins gaining real-time or unauthorised access to personal conversations.
**Mitigation:** Personal context is never stored against an org-scoped key. Admin visibility is bounded to org-context only. Log all admin audit accesses.

### Risk: Offboarding race condition

**What:** Employee retains access for seconds/minutes after removal due to cached JWTs.
**Mitigation:** Maintain a server-side revocation list checked on every request (do not rely solely on JWT expiry). Short JWT TTLs for org-context tokens.

### Risk: Shared workspace data leak

**What:** One user's output in a shared workspace is visible to others unintentionally.
**Mitigation:** Shared workspace has explicit sharing semantics. Files/outputs are private-to-user by default within the shared workspace unless explicitly published.

### Risk: Subscription billing confusion

**What:** Company pays for seats but users think they own their data.
**Mitigation:** Clear data ownership disclosure at signup. Personal context is owned by the user. Org context is owned by the company. Document this explicitly in ToS and onboarding UI.

### Anti-pattern: One workspace per user in org context

Provisioning a separate ECS task per user for company-context work is expensive and prevents genuine collaboration. Share the org workspace; isolate personal workspaces.

### Anti-pattern: Org admin = superuser

Admin should not be a superuser who can read everything. Scope admin permissions explicitly. Principle of least privilege applies.

### Anti-pattern: Soft-deleting org context on offboarding

Do not delete org-context data when an employee leaves. It belongs to the org. Delete only the access link (`org_members.removedAt`), not the content.

---

## 11. Phased Implementation Approach

### Phase 1: Foundation (prerequisite for everything else)

**Goal:** Introduce the org data model without breaking existing personal subscriptions.

- Add `organisations` and `org_members` tables (migration)
- Add `orgId` to `provisioningState` (nullable — personal users are unaffected)
- Modify `subscriptions` to support `ownerId` + `ownerType` (`user` | `org`)
- Auth middleware: add org membership check alongside user auth
- No UI changes yet; this is purely schema and backend

### Phase 2: Admin and Member Roles

**Goal:** Enable company admins to invite members and manage the org.

- Org creation flow (admin onboarding questionnaire)
- Member invite flow (email + SSO domain auto-provision)
- Role enforcement in route guards
- Org-scoped provisioning (shared workspace)
- Offboarding endpoint with synchronous access revocation

### Phase 3: Shared Channels

**Goal:** Enable genuine multi-user collaboration with Axel.

- `channels` table with org scoping
- Channel membership management
- Multi-participant session handler (Axel addresses messages to specific users)
- Channel-level memory (isolated from personal and org-wide memory)
- UI: clear visual distinction between personal and company context

### Phase 4: Admin Audit and Visibility

**Goal:** Give admins legitimate oversight tools without overreach.

- Audit log for org-context sessions (read-only admin view)
- Usage statistics dashboard (aggregated per user)
- Admin access log (meta-audit: who accessed what audit data and when)
- Compliance export (GDPR, SOC2 readiness)

### Phase 5: Advanced

- SSO/SAML integration
- Per-channel memory scope settings
- Shared knowledge base management UI
- Personal-to-org memory promotion workflow ("share this with the team")
- Cross-org federation (if relevant for enterprise accounts)

---

## Summary

The move from personal to organisational use is not just a feature — it requires a principled rethink of ownership, visibility, and isolation. The core thesis:

> **Company context is a tenant. Users are members of tenants. Personal context belongs to users, not tenants. These two contexts must never bleed into each other.**

Getting the trust boundary right from the start builds the foundation for enterprise adoption. Getting it wrong (context bleed, admin overreach, sloppy offboarding) will surface as support incidents, compliance failures, and lost deals.

The phased approach lets us ship incrementally without big-bang risk: Phase 1 is low-risk schema work that unblocks everything else, and each subsequent phase adds value independently.
