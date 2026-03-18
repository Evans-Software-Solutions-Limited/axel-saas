# Logged-Out Site: Messaging Strategy

**Owner:** Bradley
**Status:** Planning — for manual implementation
**Last updated:** 2026-03-18

---

## Core Positioning

**Headline:** One assistant. Every kind of work.

**What this means in practice:**
- Axel is not a narrow tool (not just "meeting notes" or "code review"). He handles the full sweep of knowledge work.
- The pitch is breadth + depth: one subscription, one interface, one assistant that grows with your workload.
- Competitors (Notion AI, Copilot, ChatGPT) are either siloed to one context or feel generic. Axel sits in-between: opinionated, personal, capable across domains.

**Tone:** Direct, slightly ambitious, human. Avoid AI buzzwords (synergy, seamlessly, cutting-edge). Write like a smart product person who is confident without being arrogant.

---

## Home Page

### Hero

```
One assistant. Every kind of work.

Axel handles your calendar, your code, your comms, and everything between.
Start free — no card required.
```

- Primary CTA: **Get started free**
- Secondary CTA: **See how it works** (anchors to demo/video section)

### Problem / Value strip (3 cells, short)

| Icon | Headline | Body |
|------|----------|------|
| 🗓 | Your day, planned | Axel reads your schedule, surfaces what matters, and briefs you every morning. |
| 📋 | Every meeting, captured | Summaries, action items, and follow-ups — without lifting a finger. |
| 🔧 | Built for builders too | Sub-agent orchestration and API access for technical users on any plan. |

*(Swap icons for illustrated glyphs in the final design.)*

### Social proof

Keep minimal at launch. Aim for:
- 1–2 real quotes if available, otherwise hold this section until post-launch
- A "built by the OpenClaw team" trust line (see Compliance section)

### Pricing teaser

Three tiers, one CTA to the full pricing page. Don't bury numbers on the home page — just tier names and a nudge.

---

## About / Why Axel Exists

**Page purpose:** Establish credibility and intent. Visitors who land here are evaluating trust, not features.

### Suggested narrative arc

1. **The problem:** Professionals are drowning in tool sprawl. A different app for every task, none of them aware of each other.
2. **The belief:** One capable, context-aware assistant beats ten disconnected ones.
3. **The origin:** Axel is the consumer face of OpenClaw — the same engine, made approachable.
4. **The commitment:** Privacy-first, honest about what AI can and cannot do, built for long-term use not viral growth.

### Copy direction

- Mention OpenClaw explicitly but clearly. Example:
  > Axel is built on OpenClaw, an open-source AI agent framework. We're a separate product — not affiliated with the OpenClaw project itself — but we believe in building in the open and giving credit where it's due.
- Don't over-explain the tech. Visitors want to know if they can trust the product, not how transformers work.
- End with a human sign-off: who built this, and why they care.

---

## Pricing Page

### Tiers

| Tier | Monthly Price | Target User |
|------|--------------|-------------|
| **Free** | $0 | Individuals evaluating; light personal use |
| **Premium** | TBD | Professionals wanting full Axel capability |
| **Enterprise** | Contact us | Teams, API volume, custom data retention |

### Key copy decisions

**Free tier:**
- Be explicit about limits. Users who hit a wall mid-workflow will churn.
- Suggested framing: "Everything you need to meet Axel. Limits apply on volume and sub-agents."

**Premium — 7-day upgrade offer:**
- Surface a time-limited upgrade prompt on Free after signup.
- Suggested banner or inline prompt: *"Try Premium free for 7 days — no card charged until day 8. Cancel any time."*
- The offer should appear in-app after first meaningful use (post-first-brief or post-first-summary), not immediately at signup. Don't burn the upgrade moment on a cold user.

**Enterprise:**
- Do not publish pricing. Use a "Talk to us" CTA with a short contact form or Calendly link.
- List what Enterprise adds: SSO, audit logs, SLA, custom retention, dedicated support.

### Trust signals on pricing page

- Money-back language: TBD — confirm with Bradley before publishing.
- Card requirement at free tier signup: make this crystal clear upfront. "No card required" if true.
- Cancellation terms: one line, plain English. "Cancel any time. No questions asked."

---

## Use Cases Page

**Purpose:** Help visitors self-identify. People scan this page to see if Axel is for someone like them.

### Suggested sections (each one short: 3–4 lines + CTA)

1. **The Knowledge Worker**
   - Daily briefs, meeting prep, task triage
   - "Start your day knowing what matters."

2. **The Operator / Team Lead**
   - Meeting summaries, async catch-up, team-wide status
   - "Never miss what was decided."

3. **The Developer**
   - Sub-agent orchestration, code review, technical Axel usage via API
   - "Axel is a platform, not just a product."

4. **The Solopreneur**
   - Wears all hats — calendar, comms, deliverables
   - "One person. Axel makes it manageable."

**Format guidance:**
- Each section: headline → 2-sentence description → one-line CTA ("Get started free" or "See plans")
- Avoid feature lists on this page. Features go on the pricing or home page. Use cases are about outcomes.

---

## Sign-Up Page

**Goal:** Frictionless entry. Minimum information, maximum trust.

### Copy notes

- Headline: *"Start for free. No card required."* (if true — verify)
- Sub-line: *"Set up takes about two minutes."*
- After sign-up, redirect to onboarding (already built). Don't drop the user on a blank dashboard.
- If email verification is required, set the expectation: *"We'll send a quick confirmation email."*

### Legal / consent line

One line below the signup button:
> By signing up, you agree to our [Terms of Service] and [Privacy Policy].

Links must be live before launch. No placeholder links.

---

## Compliance, Trust, and Legal

This section is non-negotiable before launch. Do not go live without these in place.

### Pages required at launch

| Page | Status | Notes |
|------|--------|-------|
| Privacy Policy | Exists (`/privacy`) | Review for accuracy against actual data handling |
| Terms of Service | Exists (`/terms`) | Review for accuracy; ensure cancellation terms are covered |
| Cookie notice / banner | Unknown | Required if using analytics or tracking cookies in EU/UK |

### OpenClaw attribution

Axel is built on OpenClaw. The site should acknowledge this clearly, but also clearly disclaim any official affiliation:

**Suggested footer or About page line:**
> Axel is powered by [OpenClaw](https://openclaw.dev), an open-source AI agent framework. Axel is an independent product and is not officially affiliated with or endorsed by the OpenClaw project.

- Use the real OpenClaw URL if/when linking. Don't link to a placeholder.
- This protects against confusion and is the honest thing to do.

### Privacy / trust wording

Suggested trust line for the home page footer or pricing page:
> Your data is yours. We don't train on your conversations or sell your information.

**Only use this line if it is accurate.** Confirm with the actual data handling setup before publishing.

Additional lines to consider:
- "Hosted on AWS" (if accurate — gives enterprise buyers confidence)
- "SOC 2 in progress" (only if actually in progress — do not claim compliance you don't have)

### What must be true before launch

- [ ] Privacy Policy reviewed and accurate
- [ ] Terms of Service reviewed and accurate
- [ ] Data retention policy documented internally (even if not published)
- [ ] Cookie/tracking situation clarified (analytics tool chosen and banner implemented if needed)
- [ ] OpenClaw attribution line live on site
- [ ] All CTA links pointing to real pages (no 404s)
- [ ] Email flows tested (signup confirmation, password reset)
- [ ] Stripe test mode disabled / live keys in place
- [ ] "No card required" claim verified against actual signup flow

---

## General Copy Rules

- Every page needs one primary CTA. Don't scatter three competing calls-to-action.
- Avoid passive voice. "Axel handles your calendar" beats "Your calendar can be managed by Axel."
- No jargon: "sub-agents" is fine for developer use case context; don't lead with it on the home page.
- Use short paragraphs. Web visitors scan. Keep blocks to 2–3 sentences.
- Read every page aloud. If it sounds like a press release, rewrite it.
