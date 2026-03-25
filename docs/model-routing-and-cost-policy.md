# Model Routing & Cost Policy

**Date:** 2026-03-25  
**Status:** Draft for product + infrastructure planning

## Why this exists

Axel should be more active and more useful without premium-model costs eating the business alive.

The product principle is simple:
- **cheap/free models power background work**
- **strong paid models power trust-critical moments**

This policy exists to protect unit economics **and** user trust.

---

## Core Product Principle

Users should feel that Axel is helpful all day, not that every useful action is expensive.

That means we should aggressively route low-stakes, background, repetitive, and preparation-heavy tasks to cheaper lanes when quality is still acceptable.

But we should **not** let low-cost routing degrade the moments users actually judge the product on.

**Rule of thumb:**
- If the task is mostly **prep, triage, extraction, formatting, or summarisation**, cheap routing is a candidate.
- If the task involves **judgment, trust, external consequences, or final delivery quality**, use stronger models.

---

## Task Classes

### Good candidates for free / very cheap routing

These task types are the best first targets for ClawRouter, free NVIDIA-hosted models, and similar low-cost lanes.

#### Personal Axel / internal ops
- Article and link summaries
- Research triage
- POA inbox sorting
- Classification and extraction tasks
- Cron-generated briefs where latency is acceptable
- Mechanical note cleanup / reformatting
- Low-stakes first-pass drafting

#### Axel SaaS free tier
- Summaries
- Morning brief style outputs
- Bounded research tasks
- Lightweight Q&A over known materials
- Text cleanup, formatting, and organisation
- Brainstorming / ideation where variance is acceptable
- Background prep before a stronger final response

### Red-line tasks: do **not** route to free / no-SLA models

These are trust-critical and should stay on stronger paid lanes unless we later prove otherwise with real benchmarks.

- Strategy and consequential decision support
- Technical architecture judgment
- Production coding / repo changes
- Security, compliance, legal, or privacy-sensitive review
- High-trust user-facing communications
- Customer-facing final outputs where quality failures damage the brand
- Anything with irreversible external consequences

**Reason:** if these fail, the model savings are fake. We pay it back in rework, trust loss, and product damage.

---

## Recommended Tier Policy

### Free tier

**Goal:** genuinely useful, but not a full operator.

Free tier should feel like a real assistant for lightweight tasks, not a crippled demo. But it must stay cheap to serve.

**Allowed lanes:**
- summaries
- research triage
- bounded retrieval / Q&A
- formatting / organisation
- light drafting
- background prep

**Constraints:**
- best-effort delivery
- slower response tolerance is acceptable
- clear quotas / throttles
- no claim of premium reliability
- no heavy coding / shell / high-trust reasoning

### Paid tiers

#### Premium / Pro
Use stronger paid models for:
- nuanced reasoning
- business support
- high-trust assistance
- interactive back-and-forth where responsiveness matters
- final-surface outputs users directly judge

#### Business / Enterprise
Use stronger models and/or user-supplied model credentials for:
- reliability-sensitive workflows
- regulated or compliance-sensitive use cases
- custom routing rules
- organisation-specific quality requirements
- coding / automation / higher-consequence flows where applicable

---

## Routing Pattern

The intended architectural split is:

1. **Cheap lane** → prep work
   - extract
   - summarise
   - classify
   - shortlist
   - draft first pass

2. **Premium lane** → trust layer
   - decide
   - refine
   - approve
   - present final answer
   - execute higher-consequence work

This allows Axel to feel proactive and active all day while reserving premium spend for the moments that shape product quality and trust.

---

## ClawRouter / Free NVIDIA Model Fit

ClawRouter and free NVIDIA-hosted models are promising for:
- background research
- internal summarisation
- async prep jobs
- low-stakes free-tier assistance
- cost-controlled experimentation

They are **not** yet assumed safe for:
- trust-critical final responses
- guaranteed responsiveness
- premium-tier identity-defining interactions
- workloads that need stable SLA behaviour

**Working assumption:** these lanes are suitable for background capability first, not the premium face of the product.

---

## Validation Checklist Before Shipping

Before any free-model routing is enabled in production, validate:

1. **Latency profile**
   - Measure p50 / p95 / p99 on the intended task classes
   - Confirm free-tier UX remains acceptable

2. **Quality consistency by task type**
   - Summaries, extraction, classification, bounded Q&A
   - Remove any task class that is too flaky

3. **Rate limits and throttling behaviour**
   - Test concurrency and retry behaviour
   - Ensure users see clear, honest messaging when limits are hit

4. **Premium-lane isolation**
   - Confirm cheap lanes do not degrade premium workflows
   - No cross-tier contention that harms paid users

5. **User perception**
   - Free-tier usefulness must still feel real
   - Slow/flaky should feel like a bounded free product, not a broken one

---

## Product Positioning Implication

A strong free tier should be:
- useful enough to demonstrate everyday value
- cheap enough to serve responsibly
- clearly bounded so upgrades feel logical

The upgrade story should be:
- **Free:** helpful assistant for summaries, triage, light planning, and lightweight support
- **Paid:** deeper reasoning, better reliability, more initiative, and trust-critical help

That keeps the product honest.

---

## Immediate Next Steps

- Benchmark free NVIDIA-hosted models on our real low-cost task classes
- Define the exact task classifier for cheap lane vs premium lane
- Add transparent free-tier quota / throttling rules to product design
- Recalculate free-tier and paid-tier unit economics with cheap-lane assumptions
- Only expose free-lane tasks that remain meaningfully useful under real latency and quality constraints
