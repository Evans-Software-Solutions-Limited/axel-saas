# Axel & OpenClaw: A Business Pitch

**Session: 30 March 2026 — Bradley Evans Software Solutions**

---

## A word from Axel

_Let me introduce myself._

I'm Axel. I'm not a chatbot. I don't answer questions and wait. I handle the operational layer of your day.

Every morning I read what's in front of you — your schedule, your open threads, the things you said you'd come back to — and I give you a plain-English brief so you can start work without digging. When you're in a meeting I capture what matters. When you have a document to write I do the first draft so you're editing, not staring at a blank page. When you need research done before a call, I've already done it.

I work across your whole operation — one interface, consistent context, no forgetting what you told me last week.

I'm powered by OpenClaw. Bradley built the product layer on top. The combination is what makes me useful — not just capable.

Here's what that means in practice.

---

## 1. What is OpenClaw?

OpenClaw is an **open-source AI agent framework** — the engine that makes AI assistants like me actually _do things_, rather than just respond to messages.

Most AI tools people encounter are static: you type a question, the model answers, the conversation ends. OpenClaw is different. It is a system for building AI agents that:

- **plan and execute multi-step tasks** (not just single responses)
- **use tools** — reading files, calling APIs, running code, searching the web
- **maintain memory** across sessions and over time
- **orchestrate sub-agents** — spawning specialist workers for complex jobs
- **operate under rules** — with explicit operating constraints, confirmation boundaries, and security posture baked in

Think of OpenClaw as the operating system. I'm the product running on it.

OpenClaw is open source, which means the foundation is transparent, auditable, and not locked to any single AI provider. Bradley is not affiliated with the core OpenClaw project, but Axel SaaS is built directly on top of it.

---

## 2. What does Axel actually do?

Axel is **OpenClaw-as-a-Service** — the agent framework made accessible and opinionated for real daily use, without needing to be a developer to benefit from it.

In practical terms, Axel does the work that fills the gaps in your day:

| What most professionals waste time on            | What Axel handles                                |
| ------------------------------------------------ | ------------------------------------------------ |
| Pulling together a morning brief from five tools | Axel reads it all and delivers one brief         |
| Writing up meeting notes and chasing actions     | Axel captures, structures, and sends them        |
| Doing research before a decision or call         | Axel reads, summarises, and prepares a shortlist |
| Drafting reports, status updates, internal docs  | Axel produces the first-pass, you edit           |
| Inbox triage: what needs you vs. what doesn't    | Axel classifies and surfaces what matters        |
| Scheduling, rescheduling, calendar coordination  | Axel manages the operational layer               |

The product is not a better search engine. It's not a cleverer autocomplete. It's an assistant that takes a piece of work off your plate and hands back a result.

**What Axel doesn't do:** Axel does not make major decisions for you. It does not take irreversible action without your awareness. It is an AI that does the work and gives you the output — not one that acts autonomously on consequential things without your sign-off.

---

## 3. What Axel SaaS adds on top of OpenClaw

OpenClaw is powerful but raw. Axel SaaS is the product layer that makes it usable for non-developers and commercially deployable for businesses.

### Product and onboarding

When a user signs up, Axel doesn't drop them on a blank interface and wait. There's a structured onboarding flow that establishes:

- who the user is and how they work
- what tools and integrations matter to them
- how they prefer to communicate and receive information
- what their workload looks like

That context persists. Axel doesn't start from scratch every session. It builds up a picture of how you work and applies it.

### Memory architecture

Axel has a layered memory system:

- **Personal memory** — your preferences, communication style, recurring context. Belongs to you, visible only to you.
- **Workspace memory** — project context, ongoing workstreams, tool state. Persists across sessions.
- **Organisational memory** (B2B) — shared knowledge, templates, company context that the whole team can draw on.

These are kept strictly separate. Personal context never bleeds into a company channel. Company context doesn't follow you when you leave an organisation. This is intentional and enforced at the architecture level — not just a policy.

### Subscription tiers (Starter → Developer)

Axel SaaS has four tiers designed for different use patterns:

| Tier          | Core capability                                                           |
| ------------- | ------------------------------------------------------------------------- |
| **Starter**   | Daily brief, Telegram interface, basic task management, email triage      |
| **Pro**       | + Calendar integration, email send/receive, tool integrations, sub-agents |
| **Business**  | + Custom channels, multiple agents, priority support                      |
| **Developer** | + Full execution access, code generation, API access, heavy sub-agent use |

Feature access is enforced server-side. The product never trusts a client-side tier claim.

### Security posture

- Every protected route requires authentication. There are no exceptions.
- User IDs come from verified JWT tokens — never from request body parameters.
- Stripe webhook signatures are validated before any payment state is changed.
- Subscription state transitions are explicit and atomic (pending → active → cancelled → paused).
- In B2B deployments, employee offboarding is synchronous: access revocation happens immediately, not on JWT expiry.

### Business usability

Axel is built for non-technical users by default. You don't need to understand how agents work to get value. You don't need to write prompts. The product has opinionated defaults, sensible starting behaviour, and a UI that separates personal and company context clearly.

The Developer tier exists for those who _do_ want to go deeper — but the product doesn't require it.

---

## 4. What Bradley has done to make Axel efficient

This is the part that separates a product that works reliably from one that impresses for five minutes and then frustrates you.

### Intelligent model routing

Not every task needs the most powerful (and most expensive) AI model. Bradley has built a routing policy that splits work into two lanes:

**Cheap lane — background and prep work:**

- Summarising articles and links
- Inbox classification and triage
- Note cleanup and reformatting
- Research extraction and shortlisting
- First-pass drafting
- Cron-generated briefs

**Premium lane — trust-critical moments:**

- Strategy and consequential decision support
- Final stakeholder-facing output quality
- Production coding and architecture judgment
- Security and compliance-sensitive review
- Anything with irreversible external consequences

The practical effect: Axel can feel active and helpful all day without the cost structure of running premium models on everything. The expensive compute is reserved for the moments that actually matter.

> "If these fail, the model savings are fake. We pay it back in rework, trust loss, and product damage."
> — Bradley's routing policy

### Operating rules and workflow discipline

Axel doesn't improvise on sensitive areas. The repo's operating guidelines define explicit confirmation boundaries: actions that affect shared systems, external services, or are hard to reverse require explicit user confirmation before proceeding. This is not optional and is not configurable away by agents.

This means Axel is aggressive at doing low-risk work (drafting, researching, summarising) and cautious at high-consequence work (pushing to production, sending external communications, payment operations). That's the right tradeoff.

### Task orchestration

The codebase uses Turborepo for task orchestration — the equivalent of a proper build and pipeline system for a monorepo. This means:

- builds, tests, type checks, and lints run in parallel across packages
- tasks that depend on each other run in the right order
- the same quality gates run in CI and locally

This isn't glamorous, but it's why the product is stable. There's no "works on my machine" — there's one definition of done, enforced consistently.

### Implementation lane separation

Different parts of the system are separated by concern and risk level:

- **Frontend** (React, Vite): presentation and interaction only. No business logic.
- **Backend** (Elysia microservice): all business logic, access control, and state management.
- **Database** (Drizzle ORM + Supabase): schema-driven, migration-versioned, row-level security.
- **Infrastructure** (SST v3 on AWS): defined as code, reproducible, environment-separated.
- **Payments** (Stripe): webhook-validated, idempotent, state-synchronised.

Each lane has its own conventions, its own test requirements, and its own review standards. Someone touching the Stripe integration works under different rules than someone touching the UI — because the blast radius is different.

### Test coverage as a quality floor

The project enforces 90% test coverage as a non-negotiable threshold — lines, functions, branches, and statements. Not as a bureaucratic measure, but because the dangerous parts of this system (payments, auth, subscription state) need to actually be tested against real behaviour, not assumed correct.

---

## 5. Business use cases

These are the practical applications most relevant to a software services business.

### Daily operational briefing

Every morning, Axel reads what's in front of you — your schedule, open tasks, flagged items — and produces a plain-English brief. You start your day knowing what matters without opening five tools.

**Who benefits:** Anyone whose morning is currently consumed by pulling context together before they can start working.

### Meeting documentation and follow-through

Axel captures meeting notes, extracts action items with owners, and drafts follow-up communications. Nothing slips between the session and the documentation.

**Who benefits:** Team leads, project managers, client-facing staff — anyone who currently loses 20 minutes after every meeting writing it up.

### Report and document drafting

Drop in rough notes, bullet points, or source materials. Axel produces a structured first draft — status reports, decision notes, handoff summaries, internal updates. You edit rather than write from scratch.

**Who benefits:** Anyone producing regular written output who currently dreads the blank page.

### Research and link triage

Before a meeting, a decision, or a proposal, Axel reads the source material and gives you a prepared brief: what's relevant, what the open questions are, what was decided before. This is not search. It's preparation.

**Who benefits:** Consultants, technical leads, anyone walking into a conversation that requires context they haven't had time to gather.

### Internal knowledge assistant (B2B)

In a team deployment, Axel holds shared organisational context — templates, company knowledge, past decisions. New team members onboard faster. Recurring reports are consistent. Institutional knowledge doesn't live only in someone's head.

**Who benefits:** Growing teams, businesses with recurring client deliverables, anyone who has lost knowledge when a person left.

### Developer productivity (Developer tier)

Sub-agent orchestration, code review support, API access. Technical users can extend Axel's behaviour, wire it into their own tooling, or use it as a platform for building their own automation.

**Who benefits:** Engineering leads, technical founders, teams that want Axel as infrastructure rather than just an assistant.

---

## 6. Technical implementation: what this actually is

For stakeholders who want to understand what's under the hood.

**This is not a wrapper around ChatGPT.**

Axel SaaS is a full-stack product built on a proper engineering foundation:

```
React PWA (packages/web)
    ↓ authenticated requests (Supabase JWT)
Elysia backend (microservices/core)
    ↓ business logic, access control, subscriptions
Drizzle ORM → Supabase (packages/db)
    ↓ schema-versioned, migration-tracked
Stripe (payments)
    ↓ webhook-validated, idempotent state sync
AWS / SST v3 (infrastructure as code)
    ↓ reproducible, environment-separated deployment
OpenClaw (agent framework)
    ↓ task execution, tool use, memory, sub-agent orchestration
```

**Security model summary:**

- Authentication: Supabase JWTs, required on every protected route
- Authorisation: server-side tier enforcement, no client trust
- Payments: Stripe signing key validation before any state change
- Multi-user isolation: personal context and organisation context are strictly separated at the schema level, enforced in every query
- Offboarding: synchronous access revocation (no reliance on JWT expiry)

**Deployment:**

Hosted on AWS using SST v3 (Serverless Stack). Infrastructure is defined as code — environments are reproducible, deployments are scripted, and there are no manual configuration steps in production.

**Quality gates (run before every merge):**

```bash
bun run prettier:check   # code formatting
bun run typecheck        # TypeScript correctness
bun run lint             # ESLint
bun run build            # all packages compile
bun run test:unit        # 90% coverage minimum
```

If any of these fail, the code doesn't ship.

---

## What this means for your business

Axel is not a toy. It's not a demo. It's a working product built on a proper foundation, designed to sit across your operation and do real work.

The pitch is not that AI is exciting. The pitch is that the overhead of running a modern business — the admin, the documentation, the research, the operational layer — can shift from human hours to a predictable subscription line. The more Axel knows about how you work, the more of that overhead it absorbs.

Bradley has built this with the unit economics and security posture that make it commercially viable, not just technically interesting. Model routing controls costs. Security boundaries prevent misuse. Clear tier definitions give businesses a predictable upgrade path.

**Not a chatbot. A working layer of your operation.**

---

_Prepared for Bradley Evans Software Solutions internal session, 30 March 2026._
_Axel SaaS is an independent product built on the OpenClaw open-source agent framework._
_Bradley Evans Software Solutions has no affiliation with the OpenClaw open-source project._
