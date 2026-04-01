# Axel SaaS — Approval & Permissions UX Spec

_Date: 2026-04-01_

## Goal

Define a clear, trustworthy approval and permissions experience for Axel SaaS so users understand:

- what Axel can do
- what Axel cannot do
- when explicit approval is required
- how approvals should feel in-chat and in-product
- how to avoid surprising or noisy permission prompts

This spec is for the Axel SaaS product UX, not just the local operator setup.

---

## Problem

Recent OpenClaw permission hardening exposed a product truth:

- users lose trust quickly when actions fail without explanation
- repeated permission prompts feel broken, not safe
- silent denials are worse than explicit guardrails
- a system can be secure and still feel bad if the UX is muddy

For Axel SaaS, permissions cannot feel like backend leakage.
They need to feel like a deliberate part of the product.

---

## Product Principles

### 1. Safety must be visible

Users should not have to guess whether Axel is allowed to do something.
The product should make capability boundaries obvious before failure.

### 2. Approval should happen at the decision point

Do not make users configure everything up front if context is missing.
Ask when the action becomes real and meaningful.

### 3. Low-risk reads should feel easy

Reading local context, searching internal notes, drafting, summarising, and similar reversible actions should feel natural and low-friction.

### 4. External and irreversible actions must feel weighty

Anything that sends, posts, purchases, deletes, modifies production systems, or exposes sensitive data should require clear, explicit consent.

### 5. Failure states must be honest

If Axel is blocked, say exactly why in plain language.
Do not hide behind generic tool errors or internal jargon.

### 6. Permission state should be inspectable

Users should be able to see what Axel currently has access to and what is blocked.

---

## Permission Model

### Permission Categories

#### A. Always allowed

Safe internal actions that do not have external side effects.

Examples:

- reading workspace files
- summarising notes
- drafting messages without sending
- analysing documents
- searching internal memory
- creating plans/checklists/specs

#### B. Allowed once connected

Actions that require the user to connect an integration first, but not approve every single read.

Examples:

- reading calendar events after Google Calendar is connected
- reading inbox summaries after email is connected
- reading CRM data after integration is connected

#### C. Ask each time

Actions with meaningful external effect, cost, privacy impact, or irreversibility.

Examples:

- sending an email
- sending a message to a real person
- creating calendar events
- posting to Slack/Discord/Telegram channels
- making purchases or trades
- editing production records
- deleting files/data
- executing shell commands in high-risk environments

#### D. Never allowed directly

Actions Axel should not do autonomously, regardless of user friction preferences.

Examples:

- revealing stored secrets/API keys back to the user in plaintext
- disabling core safety controls silently
- granting itself new capabilities
- making hidden purchases or transfers
- bypassing audit/approval pathways

---

## UX States

### 1. Capability known and allowed

Axel should just act and confirm succinctly.

Example:

- “Done — I wrote the spec to `docs/axel-saas-approval-permissions-ux-spec.md`.”

### 2. Capability available but approval required

Axel should pause before action and present a clear approval card/modal.

Example:

- “I can send this email, but I need your approval first.”

### 3. Capability unavailable because integration is missing

Axel should explain the missing connection and offer the shortest path to enable it.

Example:

- “I can check your calendar once Google Calendar is connected. Connect it in Settings → Integrations.”

### 4. Capability denied by policy

Axel should explain that the system is intentionally blocking the action.

Example:

- “I’m blocked from running shell commands in this workspace under the current policy.”

### 5. Capability failed unexpectedly

Axel should distinguish failure from permission.

Example:

- “I have permission to do that, but the action itself failed because the service timed out.”

---

## In-Chat Approval UX

### Approval request format

When asking in chat, the structure should be:

1. what Axel wants to do
2. why it wants to do it
3. the impact/risk level
4. explicit approval action

Example:

> I’m ready to send the message to Sam.
> Reason: you asked me to confirm tomorrow’s meeting.
> Impact: external message to a real person.
> Approve?
> [Approve once] [Cancel]

### Rules

- No internal tool names unless the user is technical and wants them
- No raw stack traces
- No vague “permission error” phrasing
- One approval prompt per meaningful action, not per sub-step
- Bundle dependent sub-steps into one request where possible

Bad:

- “exec denied: allowlist miss”

Good:

- “I’m blocked from running this local command under the current permissions policy.”

---

## Product UI: Permissions Surface

Add a dedicated **Permissions & Access** area in the product.

### It should show

- connected integrations
- current permission posture by category
- actions that require approval
- recent approval decisions
- blocked actions and why

### Suggested sections

#### 1. Connected accounts

- Google
- Slack
- Telegram
- GitHub
- Email
- CRM integrations

Each shows:

- connected / not connected
- scope summary
- last successful use
- revoke access

#### 2. Approval policy

User-facing summary such as:

- Internal drafting and note work: allowed
- Reading connected tools: allowed once connected
- Sending or modifying external systems: ask each time
- Sensitive secrets: never shown back

#### 3. Recent approval log

A lightweight audit trail:

- timestamp
- action requested
- approved / denied / expired
- where it came from

This builds trust and reduces “what just happened?” moments.

---

## Onboarding UX

Permissions should be introduced during onboarding without turning onboarding into a compliance form.

### During onboarding, communicate:

- Axel can work inside the app immediately
- integrations unlock more useful actions
- sending or changing things externally will still need approval
- secrets stay hidden and are not shown back

### Suggested onboarding copy

> Axel can draft, organise, summarise, and prepare work straight away.
> If you connect tools like email, calendar, or Slack, Axel can work across them too.
> Anything external or irreversible will still ask for your approval first.

That is the right shape.
Short, clear, confidence-building.

---

## Integration-Specific UX Rules

### Email

- Reading inbox summaries: allowed after connection
- Drafting emails: allowed
- Sending emails: ask each time

### Calendar

- Reading schedule: allowed after connection
- Drafting event suggestion: allowed
- Creating/updating/cancelling events: ask each time

### Messaging platforms

- Drafting replies: allowed
- Sending to real contacts/channels: ask each time

### GitHub / developer tooling

- Reading repos/issues/PRs: allowed after connection
- Opening PRs/issues/comments: ask each time by default
- Repo writes / CI-affecting actions: ask each time, with stronger warning in production contexts

### Secrets / API keys

- Enter once
- Store securely
- Never show full value back
- Show masked hint only

---

## Error Message Guidelines

### Good error copy qualities

- plain English
- one sentence on what happened
- one sentence on what to do next
- avoid blamey or robotic language

### Patterns

#### Missing integration

- “I can do that once this integration is connected.”

#### Approval required

- “I’m ready to do that, but I need your approval first.”

#### Policy blocked

- “That action is blocked by the current permissions policy.”

#### Service failure

- “I had permission, but the action failed because the service didn’t respond.”

#### Expired request

- “That approval expired before I could use it. I can ask again if you want.”

---

## Anti-Patterns to Avoid

### 1. Exposing internal policy jargon

Users should not see things like:

- allowlist miss
- host policy
- tool denied
- security mode mismatch

Unless they are in an advanced/debug view.

### 2. Prompt storms

Do not ask for approval separately for:

- opening the integration
- reading the thread
- composing the message
- sending the message

Ask once for the meaningful external action.

### 3. Silent non-action

Never leave the user wondering whether Axel ignored them, failed, or was blocked.

### 4. Fake confidence

Do not imply an action was taken when approval was not granted or the tool never ran.

### 5. Oversharing secrets

Never echo back secret values, tokens, credentials, or sensitive raw payloads.

---

## Recommended Default Policy for Axel SaaS

### Default consumer/business posture

- Internal app work: allowed
- Connected read actions: allowed
- External sends/creates/updates/deletes: ask each time
- Secret reveal/export: never

This is the best trust baseline.
It keeps Axel useful immediately without making it feel reckless.

---

## Admin / Advanced Controls

For higher tiers or technical admins, expose a more advanced policy screen.

Possible controls:

- per-integration approval mode
- always ask vs allow reads
- workspace command policy for private hosted environments
- audit retention window
- team-level restrictions

But this should stay out of the default user path.
Most users want confidence, not policy authoring.

---

## Open Questions

1. Should trusted recurring actions support time-bound approval windows?
   - Example: “Allow sending calendar invites for the next 10 minutes.”

2. Should businesses get role-based approval policies?
   - Example: assistants can draft freely, but finance actions always require manager approval.

3. Should blocked actions appear proactively in capability hints before the user asks?
   - Likely yes for major integrations, no for every edge case.

4. How much of the approval log should end users see vs admins only?

---

## Immediate Product Recommendations

### Ship first

1. Plain-English blocked/approval-required messages in chat
2. Basic Permissions & Access settings page
3. Masked integration secret handling with no reveal path
4. Approval prompts for all external/irreversible actions
5. Lightweight approval history log

### Ship later

1. Time-boxed approvals
2. Role-based team approvals
3. Granular admin policies
4. Capability simulation / preview mode

---

## Definition of Done

This area is done when:

- users can predict whether Axel will act, ask, or refuse
- blocked actions are explained clearly in plain English
- external actions always require clear consent
- integration status is visible in-product
- secrets are never exposed back to users
- approval flows feel intentional, not like backend errors leaking into UX

---

## Bottom Line

Permissions are not a backend implementation detail.
They are part of the product.

If Axel feels mysteriously blocked, users will think it is broken.
If Axel explains boundaries clearly and asks at the right moments, users will trust it more — even when the answer is no.
