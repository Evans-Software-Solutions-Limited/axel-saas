# First Routing Implementation Checklist

**Date:** 2026-03-25  
**Status:** Execution checklist

## Goal

Move from routing ideas and policy docs to a first production-ready implementation plan for Axel SaaS.

---

## Phase 1 — Product Definition

- [ ] Lock the first production task set
  - summaries
  - note cleanup
  - action/risk extraction
  - report first drafts
  - meeting brief prep
  - relevance triage

- [ ] Confirm free-tier promise in plain language
  - helpful for lightweight work
  - bounded reliability / speed
  - not positioned as full premium Axel

- [ ] Confirm paid-tier promise in plain language
  - better judgment
  - stronger polish
  - better reliability
  - more trust-critical capability

- [ ] Define which tasks are cheap-safe, hybrid, and premium-only

---

## Phase 2 — Routing Design

- [ ] Create routing matrix: task type → lane → fallback
- [ ] Define task classifier inputs
  - intent
  - output type
  - consequence level
  - tier
  - internal vs external output
- [ ] Define explicit draft vs final output states
- [ ] Define upgrade / refusal logic for out-of-scope free-tier requests

---

## Phase 3 — Evaluation

- [ ] Build benchmark set from real tasks
- [ ] Run cheap-lane quality tests on each task type
- [ ] Measure premium cleanup required after cheap draft generation
- [ ] Measure latency under real and burst usage
- [ ] Test rate limits / throttling behaviour
- [ ] Test fallback paths when cheap providers are slow or unavailable

---

## Phase 4 — UX + Messaging

- [ ] Make upgrade prompts capability-based, not token-based
- [ ] Ensure users do not need to understand model/provider names
- [ ] Decide where async / queued responses are acceptable
- [ ] Ensure free-tier slowness never feels like a bug without explanation
- [ ] Define how the UI indicates draft vs final quality level where relevant

---

## Phase 5 — Engineering Readiness

- [ ] Add routing policy layer to application design
- [ ] Add provider health / availability checks
- [ ] Add observability by task type and lane
- [ ] Add per-tier usage controls
- [ ] Add evaluation harness for regression testing
- [ ] Protect premium traffic from cheap-lane contention

---

## Phase 6 — Launch Guardrails

- [ ] Ship only task classes that remain genuinely useful under cheap-lane constraints
- [ ] Keep trust-critical outputs premium-only at launch
- [ ] Review quality monthly after release
- [ ] Be ready to remove task classes quickly if quality drifts
- [ ] Keep product trust ahead of cost optimisation

---

## Recommended First Slice

If we want the cleanest first implementation slice, start with:

1. Article / link summary
2. Notes cleanup and restructuring
3. Action / risk / blocker extraction
4. Report first draft generation
5. Research relevance triage

That is broad enough to be useful, narrow enough to evaluate, and commercially legible.
