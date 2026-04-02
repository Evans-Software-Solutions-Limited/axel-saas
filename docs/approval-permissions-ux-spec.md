# Axel SaaS — Approval & Permissions UX Spec

**Status:** Drafted for implementation
**Last updated:** 2026-04-02
**Purpose:** Define how Axel should communicate autonomy, confirmations, and hard boundaries to users without collapsing into a confusing raw-permissions UI.

---

## 1. Problem

Axel cannot feel useful if it asks permission for every tiny internal action.
Axel also cannot be trusted if it quietly sends messages, changes live systems, spends money, or shares sensitive data without clear user consent.

The product therefore needs a permissions model that is:

- understandable to non-technical users
- trustworthy by default
- simple enough for MVP
- strong enough to support business and regulated use cases later
- framed around **operating boundaries**, not tool toggles

The key UX decision is this:

> Users should configure **what Axel is allowed to do on their behalf**, not which low-level tools it may call.

We are selling a staff member relationship, not a developer console.

---

## 2. Product Principle

### 2.1 Frame it as operating boundaries

Do **not** lead with a raw permissions matrix like:
- browser ✅
- exec ✅
- send message ✅
- memory write ✅

That is the wrong abstraction for most users and creates more confusion than trust.

Instead, the product should explain Axel through three plain-language buckets:

1. **What Axel can do without asking**
2. **What Axel will always confirm first**
3. **What Axel will never do**

This matches how a sane human assistant relationship works.

---

## 3. Core Decision Model

### 3.1 Auto-allow

Axel should act proactively without asking for confirmation when work is:

- internal
- reversible
- low-risk
- not externally binding
- not sharing sensitive information

Examples:

- reading documents or webpages
- summarising information
- drafting replies without sending them
- planning and prioritising work
- organising notes or task lists
- creating internal reminders
- read-only diagnostics
- preparing specs, work orders, or briefings
- updating internal memory/context files

### 3.2 Confirm-first

Axel must ask before taking actions that create external, operational, financial, or access consequences.

Examples:

- sending emails or messages
- replying in a live channel
- creating bookings, meetings, or commitments
- changing production/live system settings
- starting or approving risky automation
- making purchases or financial commitments
- sharing or exporting sensitive information
- activating, changing, or revoking integrations
- changing permissions, access, or user roles

### 3.3 Hard-block

Axel must refuse actions that are outside the product’s ethical and safety boundary even if prompted.

Examples:

- deception or impersonation
- secret/token/password exfiltration
- bypassing access controls
- unauthorised surveillance
- legal signing or attestation
- regulated financial, legal, or medical decision-making on the user’s behalf
- harmful or hidden high-risk autonomy

---

## 4. MVP UX Shape

### 4.1 One global operating mode

For MVP, the user should not manage a large permission tree.
The product should expose a single default operating policy with clear explanation.

Suggested label:

**Axel’s operating boundaries**

Suggested default copy:

- **Works independently** on research, planning, drafting, organisation, and internal admin
- **Always asks first** before sending, booking, changing live systems, spending money, or sharing sensitive data
- **Never** bypasses security, reveals secrets, impersonates people, or takes harmful hidden actions

This should exist in:
- onboarding
- settings
- trust/safety explanation pages
- approval prompts themselves

### 4.2 Why this is the right MVP cut

This gives the user one understandable mental model.
It avoids the trap of trying to expose backend tool policy as frontend product design.

For MVP, the goal is not infinite configurability.
The goal is:

- user confidence
- predictable behaviour
- minimal surprise
- a strong trust story for demos and sales

---

## 5. Information Architecture

### 5.1 User-facing layers

The product should eventually have three layers, but only the first two are needed early.

#### Layer 1 — Global policy (MVP)
A plain-language summary of how Axel operates overall.

#### Layer 2 — Action categories (MVP / Phase 2)
A breakdown of where confirmation is required.

Recommended categories:
- Messages & emails
- Scheduling & commitments
- Live changes & automation
- Spending & commercial actions
- Sensitive data sharing
- Integrations & permissions

#### Layer 3 — Source or channel overrides (Later)
Examples:
- web app can approve, Telegram can only request
- business admin can approve integration changes, staff cannot
- specific users can authorise sends in shared environments

Do **not** put this in the first release unless a strong business case requires it.

---

## 6. Onboarding UX

### 6.1 What onboarding should do

Onboarding should establish expectations early, before the user is surprised by either passivity or overreach.

The onboarding moment should communicate:

- Axel will take initiative on internal work
- Axel will ask before external or consequential actions
- Axel has fixed safety boundaries that are not negotiable

### 6.2 Recommended onboarding copy

Suggested explanation block:

> I’ll get on with internal work like research, planning, drafting, and organising without bothering you.
> If something would send, change, spend, share, or commit on your behalf, I’ll ask first.
> And there are some things I simply won’t do — like reveal secrets, bypass access controls, or impersonate people.

This should feel like part of the hiring conversation, not legal boilerplate.

---

## 7. Approval Prompt Design

### 7.1 Goal

Approval prompts should feel like a capable assistant checking before a consequential action — not like a low-level security modal.

### 7.2 Prompt structure

Every approval request should answer:

1. **What Axel wants to do**
2. **Why it wants to do it**
3. **What will happen if approved**
4. **What data or destination is involved**
5. **Easy approve / deny paths**

### 7.3 Prompt template

Suggested structure:

**Approval needed**
- **Action:** Send a reply to James on WhatsApp
- **Why:** You asked me to confirm the revised viewing time
- **Effect:** I’ll send one message and won’t make any other changes
- **Data involved:** Message text only

Buttons:
- Approve
- Deny
- Edit first

### 7.4 Tone rules

Approval prompts should be:
- short
- plain English
- explicit about consequences
- calm, not alarmist

They should not:
- dump raw tool names
- expose internal jargon like `exec`, `message.send`, or `sessions_spawn`
- hide what is actually being approved

---

## 8. Settings Page Design

### 8.1 Name

Use:

**Approvals & boundaries**

or

**How Axel works on your behalf**

Avoid names like:
- Permissions
- Tool access
- Agent controls

Those labels are too technical and drag the product into infrastructure language.

### 8.2 MVP settings layout

#### Section A — Default behaviour
- Works independently on internal tasks
- Asks before consequential actions
- Never crosses hard safety boundaries

#### Section B — Confirmation categories
For each category, show whether Axel always asks first.

Initial categories:
- Messages & emails
- Scheduling & commitments
- Live system changes
- Spending & purchases
- Sensitive sharing
- Integration or permission changes

For MVP, these should mostly be informative rather than highly editable.
If editable, keep the available states tight and safe.

#### Section C — Hard boundaries
Read-only explanation of what Axel will not do.
This builds trust and avoids the impression that everything is negotiable.

---

## 9. Tier Interaction

This UX sits **above** tier/tool enforcement. The two must align, but they are not the same thing.

### 9.1 Rule

The frontend should explain action boundaries in user language.
The backend and runtime should still enforce actual capability limits through:
- plan/tier gating
- `openclaw.json` tool policy
- `AGENTS.md` behaviour rules
- API-level access control

### 9.2 Example

A Starter user may see:
- Axel asks before sending a message

But they should never see or care whether `exec` or `sessions_spawn` exist.
Those are implementation details.

### 9.3 Critical principle

**User-facing approvals are behavioural trust UX.**
**Tool allowlists are infrastructure enforcement.**

Do not collapse them into one concept.

---

## 10. Business / Multi-User Future

This model should extend cleanly into Business tier later.

Likely future needs:
- admin-defined company policy
- role-based approvers
- approval routing for shared channels
- audit trail of approvals/denials
- team-level restrictions on external sends or integrations

The MVP should therefore avoid dead-end design choices such as per-tool toggles that do not map to business policy.

The long-term shape should be:

- company policy sets the ceiling
- user settings define personal behaviour within that ceiling
- runtime enforcement guarantees the boundary

---

## 11. Audit & Logging Expectations

For consequential approvals, the system should eventually record:

- requested action
- user who approved or denied it
- timestamp
- relevant target/destination
- resulting status

This matters for:
- business trust
- regulated customers
- debugging disputes
- explaining why something happened

Not all of this needs full UI in MVP, but the event model should support it.

---

## 12. Non-Negotiable UX Rules

1. **Never expose raw tool names as the primary permissions model**
2. **Always explain approvals in terms of user outcomes, not system internals**
3. **Keep internal work proactive by default**
4. **Require confirmation for externally consequential actions**
5. **Keep hard-block boundaries visible and read-only**
6. **Ensure frontend copy, backend behaviour, and runtime enforcement all agree**
7. **Do not let “customisability” destroy clarity in the MVP**

---

## 13. Recommended MVP Implementation Slice

### Phase 1 — Product copy and settings shell
- add the operating-boundaries explanation to onboarding
- add an `Approvals & boundaries` settings section
- show the three buckets: works independently / asks first / never
- show confirmation categories in plain English

### Phase 2 — Approval prompt component
- standardise approval request cards/modals in chat
- include action, reason, effect, and destination/data summary
- support approve / deny / edit-first actions where relevant

### Phase 3 — Policy persistence
- persist the user’s operating-boundary preferences if we decide to expose limited edits
- keep safe defaults when no custom policy exists

### Phase 4 — Business controls
- team-level/admin-level approval policy
- audit view
- role-aware approver routing

---

## 14. Recommendation

For Axel SaaS, the right product move is:

> Sell **trustworthy autonomy**, not raw agent power.

The approval UX should make users feel:
- Axel gets on with the boring internal work
- Axel checks before doing anything consequential
- Axel has clear, visible boundaries

That is the difference between an AI employee people trust and a chatbot with settings.
