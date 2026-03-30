# Local & Private Model Strategy for Axel SaaS

**Date:** 2026-03-30
**Status:** Strategy draft for discussion — for review with Ferenc
**Author:** Bradley (via Axel)
**Related:** [model-routing-and-cost-policy.md](./model-routing-and-cost-policy.md), [nemoclaw-architecture-implications.md](./nemoclaw-architecture-implications.md)

---

## Summary

Local and private models are not interesting because they beat the best cloud models on intelligence. They don't, and pretending otherwise would be wrong.

They are interesting because they make two things economically and practically possible that cloud models cannot deliver:

1. **24/7 ambient labour at near-zero marginal cost** — background work that never stops, without a per-token bill accumulating overnight.
2. **Genuine data privacy** — processing that never leaves the user's network, making Axel viable for regulated industries and privacy-sensitive users.

This document argues that Axel SaaS should think in terms of two distinct labour layers: a local/private/cheap layer that runs continuously in the background, and a cloud/judgment/premium layer that handles trust-critical work. Getting this architecture right has compounding benefits across unit economics, product usefulness, enterprise positioning, and long-term defensibility.

---

## The Core Insight

The current model for AI assistants is reactive and expensive: the user asks something, the cloud model answers, a token bill accrues. This works for conversational assistants. It does not work for an ambient personal operator.

An ambient operator — the direction Axel is heading — needs to do things unprompted: monitor inboxes, process background information, prepare briefs, maintain documents, flag things before the user notices them. At cloud model pricing, this is economically untenable at scale. A model running 24/7 at even modest token throughput for a few hundred users would produce a cost base that destroys the unit economics of a SaaS business.

Local and private models change this calculus. A model running on a user's machine, or on a private compute allocation, has no marginal token cost. The cost is paid once (hardware or fixed compute). After that, the model can run continuously, at any frequency, without degrading margin.

This does not mean local models should replace cloud models. It means they should replace cloud models for the large class of tasks where raw intelligence is not the limiting factor — where the bottleneck is frequency, cost, or data sensitivity, not reasoning quality.

**The key question to ask for any Axel task is not "can a local model do this?" but "does this task require the full reasoning power of a frontier model, or does it require something cheaper to run more often?"**

---

## Where Local/Private Models Would Make Axel Stronger

### 1. Ambient Monitoring and Background Preparation

**The opportunity:**

Axel's most valuable potential behaviour is acting before the user asks. Morning brief. Pre-meeting research. Inbox triage. Article summaries. Flagging things that need attention. These are all tasks that currently cost money every time they run — which means they run on a schedule, not continuously, and they often feel slow or rationed.

With a local or very cheap private model, these tasks can run at a frequency that feels alive rather than scheduled. Axel could process new emails as they arrive, summarise documents as they are added to a workspace, prepare a context brief before a meeting rather than when the user asks for one.

**Why this matters for the product:**

The difference between a scheduled assistant and a continuously attentive one is felt immediately. Users describe the latter as "it just knows what's going on." That experience is difficult to manufacture with an API call on a timer. It requires a low-friction, always-on processing layer.

**Practical fit for local models:**

Summarisation, extraction, classification, and triage are exactly the tasks where smaller models perform adequately. A 7B–13B model running locally handles inbox triage or document summarisation with quality that is genuinely useful, even if it falls short of Opus-level nuance. For these task classes, good enough and always-running beats best-in-class and expensive.

---

### 2. Document and Policy Maintenance

**The opportunity:**

Many of the users Axel is targeting — small business operators, consultants, property managers, service businesses — have documents that drift: policies not updated after a rule change, procedure documents that lag practice, notes that accumulate without synthesis. Keeping these current is boring, important, and currently manual.

A local model running over a document store on a regular cadence could flag documents that appear stale, suggest updates when new information is added to context, and draft maintenance patches for human review. Not autonomously publishing changes — just doing the tedious labour of noticing that something needs attention.

**Why local models fit here:**

This work involves potentially sensitive content (internal policy, business procedures, client information). Many users and organisations are uncomfortable routing that content to cloud models. A local model changes the risk profile: the data never leaves the network. The model runs on infrastructure the user controls. The user can audit what the model has seen.

Privacy is not just a compliance checkbox here — it is what makes the feature viable for a significant portion of the target market.

---

### 3. Private Indexing and Contextual Memory

**The opportunity:**

Axel's usefulness increases with context. The more the model understands about the user's work, their history, their ongoing projects, their communication style and priorities — the better the output. Building and maintaining that context from scratch on every cloud API call is expensive and slow.

A local model running on a private compute allocation could continuously index the user's workspace: documents, emails, calendar, notes, previous Axel outputs. It builds and maintains a compact, structured context representation. When the user triggers a cloud model interaction, the rich, pre-digested context is passed along, reducing the tokens needed to get the frontier model oriented.

**The economic compounding:**

This pattern is doubly efficient. The indexing and summarisation work (cheap tasks) is done by the cheap model. The cloud model receives a tightly structured briefing and spends most of its tokens on the actual reasoning task rather than on parsing raw context. The user gets higher quality output from a shorter, cheaper prompt.

This is already partially described in the model-routing-and-cost-policy doc under "prep before premium." Local models make the prep layer richer, more continuous, and free of incremental cost.

---

### 4. Unit Economics and Margin

**The current problem:**

At cloud API pricing, serving a genuinely active background assistant is margin-destroying at scale. The cost per user of Axel running several hours of background inference per day would dwarf what most users would pay at the current price tiers. This caps how active Axel can be.

**How local models change the picture:**

For users who run Axel on their own hardware or on a private compute allocation, the marginal cost of background inference approaches zero. The business model shifts:

- **Starter/Pro:** cloud inference, bounded usage, metered background activity — the current model.
- **Business/Self-hosted:** local or private model allocation, unlimited background activity, cloud model used only for trust-critical interactions.

For the Business/Self-hosted tier, Axel can be genuinely ambient without incurring per-task cost. The product proposition improves — more active, more useful — while the cost base does not scale linearly with activity.

This is not a reason to chase local model deployments aggressively today. It is a reason to architect cleanly so that when users want to run their own model allocation, it slots in naturally, and so that the pricing model can accommodate it.

**Rough unit economics illustration (not a firm projection):**

A cloud model handling 50 background tasks per day per user at $0.01/task costs ~$18/month per user in inference alone. That leaves little margin on a $20–30/month product after infrastructure. A local model handling the same tasks at near-zero marginal cost reduces that inference spend by 70–80% depending on task mix. The remaining cloud spend covers trust-critical interactions only.

The lever is not eliminating cloud spend. It is rationing it to the tasks that require it.

---

### 5. Enterprise and Private Deployment Angle

**The opportunity:**

Enterprise and regulated-sector buyers have a consistent objection to cloud AI: "our data cannot go to a third-party model." This objection kills deals even when the product is otherwise strong. Local or private model deployment directly addresses it.

If Axel can be deployed with a local inference layer — running on the customer's own infrastructure, with sensitive data never leaving their network — it becomes viable for:

- Property management companies with tenant PII
- Professional services firms with client confidentiality obligations
- Healthcare-adjacent operators with data sensitivity requirements
- Any organisation subject to GDPR or sector-specific regulations that make cloud AI legally complicated

**What "private deployment" looks like in practice:**

This does not require shipping hardware. It requires:

1. An Axel configuration that points background inference at a self-hosted model endpoint (Ollama, vLLM, or similar) rather than a cloud API.
2. A clear policy layer that defines which tasks go to the local model and which escalate to cloud.
3. Honest documentation of what data is sent where.

The enterprise sales story becomes: "Axel runs ambient background tasks on your infrastructure. Cloud models are only invoked when you explicitly trigger a trust-critical interaction, and you control the policy for when that happens."

**NemoClaw precedent:**

The nemoclaw-architecture-implications doc already notes this pattern. NVIDIA's approach — local policy enforcement, cloud escalation only when approved — is a strong reference architecture. The local/private model strategy is the same pattern applied at the inference layer, not just the policy layer.

---

### 6. Product Architecture Implications

**The two-layer model:**

A clean way to think about the architecture is two named lanes:

| Lane          | Model class             | Cost profile       | Task class                                             | Latency tolerance     |
| ------------- | ----------------------- | ------------------ | ------------------------------------------------------ | --------------------- |
| Labour Lane   | Local / private / cheap | Near-zero marginal | Prep, triage, index, summarise, classify, format, flag | High — background OK  |
| Judgment Lane | Cloud frontier          | Per-token          | Decide, compose, review, execute, trust-critical       | Low — user is waiting |

This is not novel as an architectural idea. What is novel for Axel SaaS is wiring it cleanly so that:

- Every Axel task is classified before dispatch
- The routing policy is configurable per subscription tier
- Local model endpoints are supported as first-class alternatives to cloud endpoints
- The user (or enterprise admin) can inspect the routing log

**What this requires architecturally:**

1. **Task classifier** — before dispatching a task, classify it: background prep vs. trust-critical. The existing model-routing-and-cost-policy doc defines this taxonomy. The missing piece is the implementation.

2. **Model endpoint abstraction** — the current architecture calls the Anthropic API directly in handlers. Introducing a `ModelRouter` abstraction — which accepts a task classification and returns the appropriate model client — would allow local endpoints to be swapped in without touching handler logic.

3. **Routing policy per tier** — Starter: cloud only, bounded. Business: configurable, local endpoint supported. Developer: full control.

4. **Audit log** — which tasks went where, with what data classification. Required for enterprise buyers, useful for internal cost analysis.

None of this requires building local model support today. It requires not actively preventing it — keeping the architecture open rather than hard-wiring cloud-only assumptions.

---

## Risks, Cautions, and Non-Goals

### What this is not

- **Not a software factory pitch.** Local models running 24/7 does not mean Axel should autonomously write code, deploy infrastructure, or make decisions with irreversible consequences. The ambient labour use case is background prep, not autonomous execution. This distinction matters. The hype around "fully autonomous AI agents" has produced products that erode user trust when they act outside expectations. Axel's local model layer should be conservative in what it does without prompting.

- **Not a claim that local models are as good as frontier models.** They are not. For the task classes where quality matters — nuanced reasoning, consequential decisions, high-trust communications — frontier cloud models are the right choice. Local models enable a different class of activity, not a replacement for everything.

- **Not an immediate development priority.** The current priorities are Stripe integration, feature gating, and chat/onboarding flows. This is an architectural direction to keep in mind, not a sprint objective.

### Real risks to manage

**Quality degradation, not immediately visible:** A local model running background tasks might produce summaries or classifications that are subtly wrong without anyone noticing. If those outputs feed into Axel's context layer or are used to prepare user-visible briefs, quality failures compound. Any local model use needs explicit quality benchmarking on real task classes, not assumed adequacy.

**Security surface of local inference:** Running a local model server on a user's machine or infrastructure introduces an attack surface. A misconfigured Ollama instance is accessible over the local network. If Axel connects to user-provided endpoints, it must validate those endpoints, not trust them implicitly.

**User expectations misaligned with model capability:** If Axel describes background activity as "Axel reviewed your inbox" rather than "a lightweight model scanned your inbox," users may be surprised when the quality of that review is lower than a direct Axel conversation. Honest labelling of the model tier used for a given output is not optional.

**Complexity cost:** Two model lanes is more complex to build, test, and debug than one. The routing logic, task classifier, and endpoint abstraction add maintenance surface. This complexity should be introduced deliberately, not speculatively.

**Vendor/model lock-in shifts, not disappears:** Moving from cloud API dependence to local model dependence on a specific framework (Ollama, vLLM) introduces a different kind of lock-in. Prefer an abstraction layer that supports multiple backends over a direct dependency on any one local inference framework.

---

## What to Test First

**The highest-value, lowest-risk experiment is: local summarisation for background prep tasks.**

Specifically:

1. Take the morning brief generation task currently running on a cloud model.
2. Run the same task through a local Llama 3.1 8B or Qwen2.5 7B model (via Ollama).
3. Measure: output quality vs. the cloud model baseline, latency, and the cost differential.

If local quality is acceptable (not equivalent — acceptable), the economic case for routing that task class to local becomes concrete, not hypothetical.

**Why this specific task:**

- Morning briefs are low-stakes (no irreversible consequences).
- Quality failure is immediately visible (the user reads it).
- The task is representative of the broader ambient prep category.
- It requires no changes to user-facing product behaviour.

**What to measure:**

- Quality score (human evaluation, not automated): does the brief contain the right information in a usable form?
- Latency: is it fast enough to be genuinely useful as a morning brief?
- Consistency: does quality hold across different input types (light inbox vs. dense inbox, varied document types)?

**What success looks like:**

Local quality meets an acceptable bar (not "as good as Claude" — that is not the claim) at a cost-per-user that changes the unit economics in a meaningful way. If it does, the routing policy doc and this strategy become implementation plans. If it does not, the background prep hypothesis is falsified and we narrow to a tighter use case.

---

## Recommendation

Do not rebuild the architecture around local models today. Do three things:

1. **Keep the architecture open.** When touching model call sites, introduce the `ModelRouter` abstraction rather than hard-wiring the Anthropic client. This costs one sprint and buys optionality.

2. **Run the morning brief experiment.** Two days of engineering time. The result is either a confirmed use case with real numbers, or a falsified hypothesis. Both outcomes are valuable.

3. **Add local endpoint support to the Business/Developer tier roadmap.** Not as a near-term feature, but as a stated direction. It affects pricing model design, enterprise positioning, and the product architecture decisions made in the next few sprints. Better to account for it now than retrofit it later.

The risk of moving too fast here is shipping something that degrades product quality and confuses users. The risk of ignoring it is an architecture that is expensive to serve at scale and commercially unattractive to regulated-sector buyers. The right balance is: design for it, validate the economics, then build it carefully.

---

## Open Questions for Discussion with Ferenc

1. Is there a known enterprise prospect or sector where the private deployment story would be a deal-unlocker? If so, that should prioritise the architecture work.

2. What is the current unit economics model for the Business tier? Does local model routing materially change the viability of that tier?

3. Is there existing OpenClaw Ollama integration (mentioned as "in pipeline" in the NemoClaw doc) that should inform the timeline here?

4. How risk-tolerant are we about ambient background activity that the user hasn't explicitly triggered? This is as much a product philosophy question as an engineering one.

5. Should the `ModelRouter` abstraction be part of the core backend or the OpenClaw SDK? If this is an OpenClaw-level primitive, the implementation path and timeline are different.
