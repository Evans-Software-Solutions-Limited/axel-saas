# Task Routing Implementation Plan

**Date:** 2026-03-25  
**Status:** Planning draft

## Goal

Productionise Axel with explicit task routing so the product can be highly useful without paying premium-model costs for every step.

The key architectural principle is:
- **cheap lanes handle prep work**
- **premium lanes handle trust-critical work**

---

## Why this matters

Without routing, the product either:
1. becomes too expensive to serve, or
2. becomes low quality everywhere

We need a third option:
- cheap where safe
- premium where it matters
- clear product boundaries
- explicit fallback rules

---

## Core routing categories

### Category A — Cheap-safe tasks
These are the first production candidates for cheaper/free routing:
- summarisation
- extraction
- classification
- note cleanup / reformatting
- bounded research reads
- first-pass drafting
- report skeleton generation
- task / action / risk extraction
- low-stakes internal organisation

### Category B — Hybrid tasks
These should use a two-stage pipeline:
1. cheap lane prepares the material
2. premium lane reviews, improves, or finalises

Examples:
- internal reports
- decision notes
- meeting briefings
- product comparisons
- structured recommendations with source material

### Category C — Premium-only tasks
These stay on stronger models:
- strategy
- architecture
- trust-critical final writing
- security / compliance-sensitive interpretation
- coding judgment and implementation guidance
- high-consequence recommendations
- business-critical final outputs

---

## Recommended routing pipeline

### Step 1 — Task classification
Every incoming request should be classified into:
- cheap-safe
- hybrid
- premium-only

Classifier inputs may include:
- user tier
- task intent
- consequence level
- output type requested
- whether the output is internal or external
- whether a final recommendation is being asked for

### Step 2 — Lane selection
- cheap-safe → cheap lane
- hybrid → cheap lane then premium lane
- premium-only → premium lane

### Step 3 — Quality boundary
Before returning the final answer, the system must know whether the output is:
- rough draft
- internal working output
- final polished output

This boundary should be explicit, not implied.

### Step 4 — Fallback handling
If cheap lane fails due to:
- rate limits
- bad latency
- poor output quality
- upstream provider instability

Then the system should do one of:
- retry within policy
- queue if async is acceptable
- escalate to premium lane if the product promise requires it
- ask user to upgrade if the request exceeds free-tier scope

---

## Tier-specific behaviour

### Free tier
**Promise:** genuinely useful, best-effort assistant for lightweight work

Routing:
- cheap-safe tasks → cheap lane
- hybrid tasks → limited or upgrade-gated
- premium-only tasks → blocked or upsold

Key requirement:
- the free tier must still feel useful, not intentionally broken

### Paid individual tiers
**Promise:** reliable day-to-day partner with better reasoning and polish

Routing:
- cheap-safe tasks may still use cheap prep lane internally
- hybrid tasks use full two-stage routing
- premium-only tasks go straight to premium lane

Key requirement:
- users feel high quality and responsiveness, regardless of internal cost routing

### Business / enterprise tiers
**Promise:** stronger reliability, better controls, higher trust

Routing:
- same categories, but with stricter quality controls
- optional custom routing rules
- optional BYOM / custom provider policies

Key requirement:
- premium user experience must not be degraded by cost optimisation experiments

---

## First production task set to validate

Start with recurring, commercially relevant tasks:

1. Note → summary
2. Notes → report skeleton
3. Multi-source summary → internal update draft
4. Extract actions / risks / blockers from a doc
5. Read link and tell me if it matters
6. Create a morning brief from known sources
7. Reformat a messy document into clean sections
8. Convert bullets into internal prose
9. Compare 2–3 sources and extract key differences
10. Prepare a meeting briefing pack from existing notes

These map well to both Bradley's real use and Axel SaaS positioning.

---

## Validation work required

### 1. Quality benchmark by task type
Benchmark cheap lane vs premium lane on the first production task set.
Measure:
- usefulness
- clarity
- factual accuracy
- structure quality
- amount of premium cleanup still needed

### 2. Latency benchmark
Measure cheap-lane latency under:
- single request
- burst traffic
- concurrent free users

### 3. Failure-mode design
Define what happens when cheap providers are:
- unavailable
- rate-limited
- slow
- inconsistent

### 4. Product messaging
Ensure users understand the product promise:
- free is helpful and bounded
- paid is stronger, faster, and more reliable

### 5. Trust-preservation checks
Confirm that no trust-critical outputs are accidentally routed to cheap/no-SLA models.

---

## Product + UX implications

- Task type should be inferred automatically where possible
- Users should not need to understand model names
- Upgrade prompts should be framed around capability and reliability, not token jargon
- The system should know whether the user asked for a draft or a final answer
- Async / queued experiences may be acceptable for some cheap-lane tasks

---

## Engineering implications

At implementation time, we likely need:
- a task classifier
- a routing policy layer
- provider health / fallback checks
- observability by task type and lane
- per-tier quota controls
- evaluation harness for benchmark tasks
- an explicit internal task lifecycle model so routed work emits trustworthy state, not guessed state

This should be treated as core product infrastructure, not a side optimisation.

See also: `docs/internal-task-events-implementation-plan.md`

---

## Recommended next steps

1. Lock the first production task set
2. Build the routing matrix (task type → lane → fallback)
3. Benchmark cheap lane on real examples
4. Define free-tier boundaries in product copy and onboarding
5. Ship only the task types that remain genuinely useful under real latency and quality constraints
