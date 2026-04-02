# Axel SaaS — Repo Guardrails

**Status:** Active operating policy
**Last updated:** 2026-04-02
**Purpose:** Keep local repo state clean, make task outcomes unambiguous, and stop the Axel SaaS repo from drifting into branch sprawl, duplicate-copy confusion, and local-only work.

---

## 1. Why this exists

Axel SaaS does not have a cleanup problem because someone forgot to tidy up once.
It has a cleanup problem because the operating pattern allows drift to accumulate:

- multiple local copies of the same repo
- long-lived branches with unclear status
- docs/specs created locally without a clear finish line
- work that exists on EC2 but is not pushed, reviewed, or intentionally discarded
- product artefacts spilling into the global workspace instead of the repo

A one-off cleanup helps for a week.
Guardrails prevent the same mess from reforming.

---

## 2. Canonical repo rule

### 2.1 One canonical local repo

The canonical local Axel SaaS repo is:

`/home/ubuntu/workspace/axel-saas`

This is the default location for:
- docs
- product specs
- implementation work
- review-ready local state

### 2.2 Other copies must be intentional

Any other local copy must be explicitly one of:
- temporary
- agent-only
- archival/reference
- isolated experiment

If a second copy exists and nobody can clearly explain why, it should be treated as suspect and reviewed for deletion.

### 2.3 No ambiguous parallel active copies

We should not have multiple “real” active Axel SaaS repos on the same box with overlapping purpose.
That creates uncertainty about:
- which branch is current
- where new work should start
- whether something was already done elsewhere
- whether local state is meaningful or stale

---

## 3. New work policy

### 3.1 Start from main

Every new task should start from current `origin/main` unless there is a deliberate reason not to.

Standard pattern:
1. fetch
2. update local main reference
3. create a fresh branch from `origin/main`

### 3.2 No zombie-branch revival by default

Do not revive half-finished or old local branches just because they already exist.
An old branch should only be reused if:
- it is still the correct scope
- its remote state is known
- it is clearly still the intended workstream

Otherwise: start clean.

### 3.3 Branch names should explain themselves

Branch names should stay short and explicit, for example:
- `docs/approval-permissions-ux-spec`
- `feat/chat-approval-card`
- `fix/subscription-state-polling`

Avoid vague or overly clever names.

---

## 4. Finish-line policy

### 4.1 Local-only does not count as done

For Axel SaaS, local EC2 work is not a valid finish line.
A task matters only if it ends in one of these states:

- **pushed** to GitHub
- **opened/updated as a PR**
- **explicitly discarded**
- **archived intentionally** as reference-only documentation

“Done locally” is not done.

### 4.2 Every task must end visibly

Each task should have a visible end state:
- pushed branch
- PR link
- merged
- discarded
- archived note explaining why it exists

If nobody can tell which of those applies, the task is not actually finished.

### 4.3 PR bias for keeper work

If the work should survive, prefer:

commit → push → PR

That applies to docs/specs as well as code when they materially affect product direction.

---

## 5. Docs and product artefacts

### 5.1 If it matters, it lives in the repo

Axel SaaS product thinking should not live indefinitely as local notes scattered across the global workspace.
If a spec, policy, architecture note, or implementation plan matters to the product, it should live inside the Axel SaaS repo.

Default home:
- `docs/` for specs, plans, policy notes, architecture notes

### 5.2 Scratch is allowed, but it must stay obviously temporary

Temporary drafts are fine during active work, but they must be:
- clearly named
- short-lived
- either promoted into the repo or deleted

Do not leave ambiguous temp files lying around as pseudo-source-of-truth.

### 5.3 One source of truth per topic

Do not create duplicate docs for the same policy in multiple places without a clear reason.
If a document supersedes another one, say so plainly.

---

## 6. Branch hygiene

### 6.1 Prune routinely

Merged or obsolete branches should be pruned on a regular cadence.
The point is not aesthetic tidiness. It is to reduce ambiguity and false leads.

### 6.2 Review old branches before starting new ones in the same area

Before creating another branch in the same problem space, check whether:
- a branch already exists remotely
- a PR is already open
- the old work should be merged, replaced, or discarded

### 6.3 Stale local branches are a liability

A stale branch is not harmless. It creates false confidence that work exists or can be resumed cheaply.
If a branch has no clear current purpose, it should be reviewed and pruned.

---

## 7. Guardrails for agent-driven work

### 7.1 Main session should not quietly become the coding lane

The main session is for:
- planning
- investigation
- review
- decision-making
- memory and operating policy updates

It should not casually slide into repo implementation work just because a change looks small.

### 7.2 Repo work must use the agreed lane

For real repo work, use the implementation lane and keep the finish line explicit.
Docs are lighter than feature code, but they still count as repo work and should not become a loophole for boundary drift.

### 7.3 No hidden repo drift

If repo work is performed, it should be surfaced clearly:
- what changed
- where it changed
- whether it was pushed
- what the next review action is

---

## 8. Review and merge discipline

### 8.1 Open PR is not merge

A pushed branch or opened PR is not the same as “ship it.”
Review state must stay explicit.

### 8.2 Bradley reviews merges unless explicitly delegated

Unless Bradley explicitly delegates otherwise, merge authority stays with him.

### 8.3 Do not imply repo state you have not verified

Never say something is merged, review-ready, or replaced unless the repo/GitHub state confirms it.

---

## 9. Workspace boundary rule

### 9.1 The global workspace is not the Axel SaaS overflow bin

The global OpenClaw workspace can hold cross-project notes, memory, and operating docs.
It should not become the default resting place for Axel SaaS product artefacts that belong in the actual repo.

### 9.2 Promote or delete

If an Axel SaaS doc in the global workspace becomes important, promote it into the repo.
If it does not matter, delete or archive it intentionally.

---

## 10. Minimal operating checklist

Before starting Axel SaaS work:
- Am I in the canonical repo?
- Am I starting from current `origin/main`?
- Does this task already exist on another branch or PR?
- Will the output live in the repo, or is it truly temporary?

Before calling Axel SaaS work done:
- Is it committed?
- Is it pushed?
- Is there a PR or a deliberate reason there is not?
- If not kept, was it explicitly discarded?

---

## 11. Non-negotiable rules

1. **One canonical active local repo**
2. **New work starts from current main by default**
3. **Local-only work does not count as done**
4. **Docs/specs that matter live in the repo**
5. **Merged/stale branches must be pruned regularly**
6. **Main session must not quietly become the repo implementation lane**
7. **Every task needs a visible end state**

---

## 12. Recommendation

For Axel SaaS, the right goal is not “keep things tidy.”
The goal is:

> make repo state boring, obvious, and hard to misunderstand.

That means fewer active copies, fewer ambiguous branches, clearer finish lines, and less local-only drift.
