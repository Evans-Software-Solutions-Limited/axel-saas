# NemoClaw Architecture Implications

**Date:** 2026-03-19
**Context:** NVIDIA NemoClaw — policy-based guardrails + privacy routing as enterprise architecture pattern

---

## What NemoClaw Actually Does

NVIDIA's NemoClaw puts a local security layer on top of OpenClaw: Nemotron models run on-device, enforce policy rules on what agents can do (via OpenShell), and route to cloud models only when local execution falls short or explicit rules permit it. Agents can extend with new skills, but only within the defined policy envelope.

The core contribution isn't the local GPU — it's the **architectural separation** of:
1. What an agent is allowed to do (policy)
2. Where data is allowed to go (routing)
3. What counts as a cloud-eligible request (classification)

---

## Axel SaaS — Concrete Architecture Implications

### 1. Policy-Based Guardrails

**What this means in practice:**

Guardrails defined at the infrastructure layer, not just in prompts. A prompt instruction ("don't share tenant data") is soft — it can drift, be overridden by another instruction, or fail silently. A policy rule is hard: the agent literally cannot call a tool or route data outside the defined boundary.

**For Axel SaaS right now:**

The `requireAuth` / `getAuthUser` pattern already enforces access control at the HTTP boundary. The gap is at the *agent behaviour* level — there's nothing stopping a future Axel skill from exfiltrating user data or calling an unapproved external service. This needs to be explicit.

**Concrete implementation:**

```typescript
// infra/agent-policy.ts — define what an agent instance can do
export type AgentPolicy = {
  allowedTools: string[];           // whitelist of skill/tool names
  externalCallsPermitted: boolean;  // can this agent make outbound HTTP?
  dataClassifications: string[];    // e.g. ['public', 'internal'] — not 'pii', 'financial'
  cloudModelFallback: boolean;      // can this agent escalate to Claude/GPT?
};
```

Attach policy to the user's subscription tier and workspace config. Starter tier: restricted tool set, no external calls. Business tier: broader tool access, explicit data classification required.

This is also the foundation for per-client customisation — lettings agencies will want to lock down their Axel instance differently from a solo founder.

### 2. Privacy Routing / Data Egress Control

**What this means in practice:**

Every LLM call is a potential data egress event. If a user types a message containing tenant PII (name, address, rent arrears) and that goes verbatim to Anthropic's API, the user's GDPR obligations just got complicated. The NemoClaw approach: classify data before routing, strip or anonymise PII before cloud calls, keep sensitive work local.

**For Axel SaaS right now:**

Bradley's stack is cloud-native (AWS/Supabase), so "local execution" isn't the immediate option. But the *routing decision* pattern is directly implementable:

```
User message → PII classifier →
  if clean: route to Claude API (fast path)
  if PII detected: anonymise → route to Claude API, or refuse + log
```

A cheap Haiku/Qwen call for PII classification before each Claude API call costs ~$0.001 and gives a defensible GDPR audit trail.

**Data sovereignty positioning for UK clients:**

> "Your tenants' data stays in your Supabase instance. What we send to Claude is anonymised: 'Tenant A owes £X for property Y' not 'John Smith owes £1,200 for 14 Acacia Avenue.'"

This is a real differentiator for lettings agencies, gym operators with health data, and any client in a regulated sector.

### 3. Subscription Tier Enforcement

Policy-based guardrails map cleanly onto the existing subscription tiers:

| Tier | Agent Policy |
|------|-------------|
| Starter | Pre-approved tool list only, no external HTTP, no PII classification bypass |
| Pro | Extended tool set, external HTTP with logging, basic PII classification |
| Business | Custom tool allowlist, full audit log, PII classification + anonymisation, SSO |
| Developer | Policy as code — define your own ruleset, API-first |

This is the enterprise unlock. Business and Developer tiers sell on the *policy story*, not just feature count.

---

## Bradley's Local OpenClaw Setup — Concrete Hardening Implications

Bradley runs OpenClaw on AWS (not a local GPU rig), so the NVIDIA hardware angle doesn't apply directly. The relevant patterns:

### 1. Define an Agent Policy File

Create `~/.openclaw/workspace/policies/axel-policy.json`:

```json
{
  "allowedSkills": ["research", "coding", "heartbeat", "morning-brief", "discord"],
  "deniedSkills": [],
  "externalHTTP": {
    "permitted": true,
    "domains": ["anthropic.com", "openai.com", "github.com", "supabase.io"],
    "logAll": true
  },
  "piiHandling": "log-and-warn",
  "cloudModelFallback": true,
  "dataClassification": ["public", "internal", "confidential"]
}
```

This is aspirational today but sets the expectation for OpenClaw's own guardrails support. When NemoClaw patterns land in OpenClaw (or if OpenClaw gets a policy primitive), this is the config to have ready.

### 2. PII in Local Workspace

The `~/.openclaw/workspace/` directory likely contains client names, financial data, and operational notes. Two immediate hardening steps:

- **At rest:** Ensure the workspace directory is on an encrypted volume (AWS EBS encryption or local disk encryption). Currently unknown — worth verifying.
- **In transit:** Any skill that reads workspace files before making a Claude API call is a potential PII egress path. Audit the `research` and `coding` skill context windows for what they include in API payloads.

### 3. Skill Allowlisting

The OpenClaw skills directory (`~/.openclaw/skills/`) grows over time. Without a policy, any skill can make external HTTP calls. A periodic audit of installed skills — what can they call, what context do they receive — is worth doing quarterly.

Short term: just maintain a list of approved skills and flag any new installs before they get system-level access.

---

## What to Prioritise Now vs Later

### Now (before first paying customer)

1. **Data classification in chat handler** — tag any user message that hits the chat endpoint with a basic classification (contains PII / no PII). Log it. Don't act on it yet, just instrument it. Cost: 2-3 hours.

2. **GDPR data sovereignty statement** — write one paragraph for the Axel SaaS landing page: what data goes to Claude, what stays in the user's Supabase instance, what logging exists. This unblocks enterprise conversations.

3. **Tool/skill allowlist per subscription tier** — the subscription tier enforcement table above. Wire it into the `requireAuth` context so handlers can gate by `user.tier`. Cost: half a sprint.

### Soon (before enterprise pilot)

4. **PII anonymisation middleware** — intercept chat requests before Claude API calls, run a cheap classifier, strip or hash PII. The Haiku-based pre-filter pattern. Cost: 1 sprint.

5. **Audit log** — every Claude API call logged with: user ID, tool invoked, data classification, model used, response token count. This is the GDPR audit trail. Cost: 1 sprint.

6. **Agent policy config per workspace** — allow Business tier users to define their own allowed tool list. The schema above is the starting point. Cost: 1-2 sprints.

### Later (post-product-market-fit)

7. **Local execution lane** — if/when OpenClaw supports on-device models (Ollama integration is in the pipeline), route PII-heavy tasks to local models as first choice. Cost: revisit after Ollama POA is resolved.

8. **NemoClaw native integration** — if NVIDIA's toolchain matures and OpenClaw adds official support, evaluate replacing the custom PII routing with a NemoClaw policy layer. Don't build against it today — the API surface is still in flux.

---

## Practical Next Steps

**This week:**

- [ ] Add a `dataClassification` field to the chat message schema (Drizzle migration, `packages/db`)
- [ ] Add a one-paragraph GDPR/data sovereignty section to the Axel SaaS landing page copy
- [ ] Add "policy-based guardrails + privacy routing" to the Axel SaaS architecture decision log

**This month:**

- [ ] Wire subscription tier to an `AgentPolicy` type in the core backend — even if it's a stub, define the shape now
- [ ] Implement basic audit logging on the chat endpoint (user ID, timestamp, model, token count, data classification)
- [ ] Draft the data sovereignty positioning statement for the enterprise pitch deck: "your data stays in your Supabase instance"

**Before enterprise pilot:**

- [ ] PII classifier middleware (Haiku pre-filter before Claude API calls)
- [ ] Tool allowlist enforcement per tier
- [ ] GDPR processing record for Axel SaaS (you'll need one before signing enterprise contracts)
