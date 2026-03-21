# Axel Website Copy & Structure Audit

**Owner:** Ferenc (changes), Bradley (copy sign-off)
**Status:** Draft — for review
**Last updated:** 2026-03-21
**Scope:** Current logged-out marketing pages based on codebase review (Home, Pricing, Use Cases, About, Nav)

---

## Summary Verdict

The current site is well-structured and avoids the worst AI marketing clichés. The main gaps are:

1. **The positioning is too generic.** "One assistant. Every kind of work." is forgettable and doesn't communicate the "AI employee" differentiation.
2. **SMB/founder specificity is absent.** No clear statement of who this is for.
3. **The use cases feel observer-mode.** They describe what Axel does, not what the _user_ stops doing.
4. **Pricing copy is vague.** "Meet Axel" and "Full Axel capability" are placeholders, not selling copy.
5. **No trust signals.** No social proof, no data privacy line, no credibility anchors.

---

## Page-by-Page Audit

### Home (`/`)

**Current H1:** "One assistant. Every kind of work."
**Issue:** Generic. Could describe Notion, ChatGPT, or a Swiss Army knife. No differentiation from competitors.
**Change to:** One of the hero options in the messaging pack — lead with "AI employee", "24/7", or the SMB pain angle.

**Current subhead:** "Axel handles your calendar, your comms, and everything between — built to feel like a personal assistant, not a developer tool."
**Issue:** "Feel like a personal assistant" undersells it. Axel _is_ the assistant. Also "not a developer tool" is a defensive frame — we're telling people what we're not instead of what we are.
**Change to:** Drop "feel like". Lead with concrete tasks. Example: "Axel handles your daily briefing, your meeting notes, your follow-ups, and your schedule — so you can focus on the work only you can do."

**Value cells — current:**

- "Your day, planned" — Good. Keep.
- "Every meeting, captured" — Good. Keep.
- "Connects to how you work" — Weak. "No engineering degree required" is the wrong tone for SMB founders who aren't engineers.
  **Change to:** "Your ops layer, no ops hire." Body: "Axel sits across your tools, tracks what needs doing, and flags what needs you. The admin your business needs, done."

**Pricing teaser — current tier names:** Free / Premium / Enterprise
**Issue:** "Premium" is generic. Rename to something that communicates the user ("Professional" or "Business"). Also "Meet Axel" and "Full Axel capability" are empty phrases.
**Change to:**

- Free: "Light use. Meet Axel."
- Pro/Business: "Full Axel. Built for serious work."
- Enterprise: "Teams, custom setup, dedicated support."

**Missing entirely:**

- A trust strip (social proof or "built on OpenClaw" attribution)
- A clear "who this is for" line near the hero
- A problem statement before the value cells

---

### Pricing (`/pricing`)

**Current H1:** "Pricing"
**Issue:** Functional but not a selling headline. Users who land here are evaluating trust, not just price.
**Change to:** "Simple pricing. No surprises." or "One plan covers everything Axel does."

**Current intro paragraph:** References £49/month Premium, mentions opening in stages.
**Issues:**

- Mixing currency (£) when targeting SMB market — clarify if GBP-only or multi-currency
- "Opening in stages" is fine but buries it in the intro — make it a confidence signal, not a caveat
- "Premium is £49/month" mentioned in prose, not highlighted in the card — inconsistent

**Per-tier issues:**

- Free tier description "Meet Axel — limits on volume and sub-agents": "sub-agents" is technical jargon for non-developer SMB users. Replace with plain English: "Explore Axel with limits on daily usage."
- Enterprise card: Good. Keep the "Talk to us" framing.

**Hosted deployments section:** Good. Keep. Consider adding a one-line tease of what types of businesses this suits (e.g., "For agencies, consultancies, and teams with specific data requirements.")

**FAQ section:** Good. "How do I get access?" is the most important FAQ — make sure its answer is compelling, not just functional. Currently it says we'll invite in batches. Consider adding a wait time estimate or number in queue to make it feel real.

---

### Use Cases (`/use-cases`)

**Current H1:** "Use cases"
**Issue:** No target keyword, no emotional hook. This page is a conversion opportunity.
**Change to:** "Axel for [your role]" or "Who Axel is for" — but ideally something more active: "What Axel does for you"

**Current sections:**

- "The Knowledge Worker" — Fine, but "knowledge worker" is a generic office-job frame. Rename to something more specific for the SMB audience: "Founders & Busy Professionals"
- "The Operator / Team Lead" — Good persona. Consider renaming to "Agency Owners & Team Leads" if SMB is the primary vertical
- "The Developer" — Current copy walks back the power-user angle ("a wide-open public API is not how Axel is positioned"). This feels defensive. Replace with a more confident frame: what developers _do_ get, not what they don't.
- "The Solopreneur" — Excellent. Keep and consider promoting this higher — solopreneurs are likely the highest-traffic search persona.

**Missing:** An intro paragraph that speaks directly to SMB pain before the sections. Something like: "Most AI tools are built for individuals or enterprise. Axel is built for the space in between — businesses small enough that every hour of admin costs you directly."

---

### About (`/about`)

Not reviewed in detail (file not read), but based on the messaging strategy doc:

- Ensure OpenClaw attribution is live and accurate
- Include a human sign-off (founder names/origin story)
- Frame the product as "the consumer face of OpenClaw" clearly

---

### Navigation

**Current links:** (not fully confirmed, but inferred from layout)
Likely: Home, Use Cases, Pricing, About, Sign Up / Join Waitlist

**Recommended changes:**

- Ensure the primary CTA in nav is "Join waitlist" (not "Sign up" — sets clearer expectations pre-launch)
- Consider adding a "Blog" link once content is live — SEO traffic needs a home
- If a demo or product video is added, add it to nav as "How it works"

---

## Priority Change List

Do these first — highest impact, lowest effort:

1. **Home H1:** Change to AI employee / 24/7 framing (see messaging pack options A/B/C)
2. **Home subhead:** Remove "feel like" — Axel _is_ the assistant, not a simulation
3. **Home value cell 3:** Replace "Connects to how you work" cell with SMB ops framing
4. **Use Cases intro:** Add a 2-sentence SMB pain framing before the persona sections
5. **Pricing tier descriptions:** Replace jargon ("sub-agents") with plain English
6. **Add one trust line to home:** Either data privacy statement or OpenClaw attribution — it's missing entirely
7. **Pricing H1:** Change "Pricing" to something with a value signal

---

## What's Working — Do Not Change

- The overall page structure is clean and logical
- Pricing FAQ section is honest and covers real objections
- Hosted deployments section is professional and targeted correctly
- The waitlist framing is handled well — it's a trust signal not just a queue
- Use case structure (persona → outcome → CTA) is the right format
- General tone: direct, not jargony — maintain this across all new copy
