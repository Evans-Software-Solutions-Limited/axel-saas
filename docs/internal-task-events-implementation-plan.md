# Internal Task Events Implementation Plan

**Date:** 2026-03-25  
**Status:** Planning draft

## Goal

Define the first Axel SaaS implementation slice for an **internal event-driven task lifecycle system**.

This is not just about Claude.
It is the common lifecycle model for any background or internal task run that Axel may perform, including:

- model-routed prep tasks
- research/background reads
- long-running summarisation/drafting work
- future coding/automation lanes where applicable
- later UI visibility into what Axel is doing

The local workspace version has now been proved in principle using:

- append-only JSONL events
- Claude launcher as first producer
- conservative lifecycle events (`task.started`, `task.completed`, `task.failed`, `task.review_ready`)

The Axel SaaS version should reuse that contract, not invent a different one.

---

## Why this should exist

Right now, without an explicit task lifecycle, the system has to guess from logs, provider text, or ad hoc state.

That creates ambiguity around:

- did the task actually start?
- is it still running?
- did it fail or merely go quiet?
- is there a useful result yet?
- is the output draft-quality, done, or review-ready?
- what should the UI show the user right now?

This should not be guesswork.

---

## Core Design Principle

**Task producers emit events.**  
**The product consumes lifecycle state.**

That separation matters.

Producers may include:

- cheap-lane prep worker
- premium-lane finaliser
- research worker
- internal workflow runner
- future coding/automation producer

Consumers may include:

- task status UI
- chat surface
- notifications
- follow-up orchestration
- observability / support tooling

---

## Recommended First Product Slice

Keep the first Axel SaaS slice small and honest.

### Include

- one internal task record / identity
- append-only lifecycle events for that task
- conservative status projection from events
- enough metadata to explain what happened
- one or two initial producers only

### Exclude for now

- real-time streaming complexity
- retries/orchestration engine
- dependency graphs
- complicated multi-step DAGs
- generic event bus infra
- full workflow automation UI

This should stay boring.

---

## v1 Event Contract

### Initial event types

- `task.started`
- `task.completed`
- `task.failed`
- `task.review_ready`
- `task.no_changes` **(recommended addition for product version)**

### Why add `task.no_changes`

The local smoke test already hit a meaningful real-world state:

- task ran
- no system failure occurred
- but there were no keeper changes/artifacts

That state matters for product truth.

It should not be forced into either:

- success with meaningful output, or
- failure

So Axel SaaS should explicitly model it.

### Deferred event types

Defer these until needed:

- `task.progress`
- `task.blocked`
- `task.needs_human`
- `task.artifact.created`
- `task.pr.updated`

They are useful later, not required for the clean first slice.

---

## Suggested Data Model

### 1. Task

One row/document per task run.

Suggested fields:

- `id`
- `userId`
- `sessionId` or `conversationId`
- `source` (chat, cron, workflow, system)
- `taskType`
- `taskIntent`
- `requestedOutputKind` (draft, internal, final)
- `tier`
- `lane` (cheap, premium, hybrid)
- `createdAt`
- `updatedAt`

This is the stable identity.

### 2. Task Event

Append-only records keyed by `taskId`.

Suggested fields:

- `id`
- `taskId`
- `eventType`
- `status`
- `producer`
- `timestamp`
- `payload` (JSON)

Payload may include:

- provider/model info
- artifact references
- timing
- output summary
- error summary
- review readiness hints

### 3. Projected Task State

Do **not** treat raw events as the only read model for product UI.

Instead, project events into a simple current-state view such as:

- `queued`
- `running`
- `completed`
- `failed`
- `review_ready`
- `no_changes`

This is what the product should render.

---

## First Producers to Support

Start with the producers that align with the routing strategy.

### Producer 1 — Cheap-lane prep task

Use for:

- summaries
- extraction
- note cleanup
- relevance triage
- report skeletons

### Producer 2 — Premium-lane finaliser

Use for:

- recommendation layer
- final polish
- trust-critical wording
- judgment-heavy final output

This maps directly to the product decision already locked:

- cheap lane does the legwork
- premium lane does the judgment

Claude was the first local producer, but for Axel SaaS the first product producers should reflect the actual routing model, not the local tooling accident.

---

## Status Projection Rules

Keep them simple.

### Suggested projection

- latest `task.started` with no terminal event → `running`
- latest terminal event `task.completed` → `completed`
- latest terminal event `task.failed` → `failed`
- latest terminal event `task.review_ready` → `review_ready`
- latest terminal event `task.no_changes` → `no_changes`

Terminal means: once emitted, it becomes the visible latest state unless a later event explicitly supersedes it.

For v1, avoid clever state machines.

---

## UX Implication

The user should not need to understand event names.

They should see clear state like:

- Working on this
- Done
- Done — nothing changed
- Needs review
- Failed

The chat/product layer can translate internal lifecycle truth into clean language.

---

## Relationship to Routing Work

This task lifecycle system is the operational backbone for routing.

Routing decides:

- what lane should do the work
- whether it is cheap, premium, or hybrid

Task events answer:

- what happened after routing
- what state the work is in now
- what the UI or follow-up logic should do next

So this is **not separate from routing infra**.
It is the execution/lifecycle half of the same architecture.

---

## Recommended Engineering Order

### Phase 1 — Product contract only

- define task + task_event shapes
- define terminal statuses
- define projection rules
- define first producer interfaces

### Phase 2 — First storage implementation

- add task + task event persistence in the product backend
- append-only events
- minimal state projection

### Phase 3 — First real product producer

- cheap-lane prep task emits lifecycle events
- backend can return projected state

### Phase 4 — UI visibility

- show lightweight task status in chat / task surface
- do not overbuild dashboards yet

### Phase 5 — Hybrid routing integration

- cheap task starts
- premium finaliser continues/finishes
- both write to same task identity

---

## Non-Negotiable Guardrails

- do not infer final success from hopeful provider text alone where stronger evidence is available
- do not treat "completed" and "useful outcome exists" as identical
- do not conflate no-op/no-change with failure
- do not build a heavyweight workflow engine before the lifecycle contract proves useful
- do not let product UI expose raw internal events directly

---

## Recommendation

For Axel SaaS, the next implementation doc set should treat this as:

**Task routing policy + task lifecycle events = one system**

Routing chooses the lane.
Events make the work observable and trustworthy.

The clean first product implementation should therefore be:

1. task identity
2. append-only task events
3. projected current state
4. cheap-lane prep producer
5. premium-lane finaliser later

That is the smallest honest product slice.
