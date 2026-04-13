# Axel SaaS — Feature Specs

Spec-driven development for the Axel SaaS MVP. Each feature area has its own folder containing four documents:

| File | Purpose |
|---|---|
| `design.md` | Architecture, data model, UI wireframes, integration points |
| `requirements.md` | User stories with acceptance criteria |
| `tasks.md` | Implementation checklist — tick off as you go |
| `agents.md` | Instructions for AI coding agents working on this feature |

## Implementation Priority

Work in this order. P0 features are blocking — nothing ships without them. P1 features complete the experience. P2 features harden the platform.

### P0 — Foundation (must ship)

| # | Feature | Folder | Scope | Dependencies |
|---|---|---|---|---|
| 1 | [Tier Alignment](./tier-alignment/) | `specs/tier-alignment/` | Full-stack | None (do first) |
| 2 | [Onboarding & Auth](./onboarding-auth/) | `specs/onboarding-auth/` | Frontend + backend | Tier alignment |
| 3 | [Gateway Contract](./gateway-contract/) | `specs/gateway-contract/` | Backend (shared with Ferenc) | None (can parallel with #1) |
| 4 | [Token Management & Cost Control](./token-management/) | `specs/token-management/` | Full-stack | Tier alignment, gateway contract |
| 5 | [Integrations & Credentials](./integrations/) | `specs/integrations/` | Full-stack | Workspace config sync |
| 6 | [Workspace Config Sync](./workspace-config-sync/) | `specs/workspace-config-sync/` | Backend | Gateway contract |

### P1 — Complete Experience

| # | Feature | Folder | Scope | Dependencies |
|---|---|---|---|---|
| 7 | [Office (Agent Visualisation)](./office/) | `specs/office/` | Frontend | Tasks API exists |
| 8 | [Tasks](./tasks/) | `specs/tasks/` | Frontend | Tasks API exists |
| 9 | [Settings & Billing](./settings/) | `specs/settings/` | Full-stack | Tier alignment, Stripe |
| 10 | [Crons & Schedules](./crons/) | `specs/crons/` | Full-stack | Workspace config sync |
| 11 | [Email & Notifications](./email-notifications/) | `specs/email-notifications/` | Backend | None (can parallel) |

### P2 — Hardening

| # | Feature | Folder | Scope | Dependencies |
|---|---|---|---|---|
| 12 | [Routing Classifier Alignment](./routing-classifier/) | `specs/routing-classifier/` | Backend | Tier alignment |
| 13 | [Authenticated Rate Limiting](./rate-limiting/) | `specs/rate-limiting/` | Backend | None (can parallel) |

## Suggested Execution Order (5-day sprint)

### Day 1 (Mon): Foundation
- **Tier alignment** — DB migration, backend handlers, frontend plan cards
- **Gateway contract** — finalise with Ferenc, start backend gateway client
- **Onboarding & auth** — re-enable signup/login routes

### Day 2 (Tue): Core Backend
- **Token management** — DB schema, usage tracking, cap enforcement
- **Workspace config sync** — central service, file generators
- **Rate limiting** — middleware (thin, do in parallel)

### Day 3 (Wed): Integrations
- **Integrations** — credential vault, encryption, registry, frontend page
- **Email notifications** — email service, replace stubs, send on key events

### Day 4 (Thu): Dashboard Pages
- **Office** — wire to real task data, shared hook
- **Tasks** — wire to API, expandable detail, filters
- **Settings** — profile, billing, Stripe portal, cancel flow

### Day 5 (Fri): Polish & Ship
- **Crons** — schedule CRUD (if time allows, otherwise post-MVP)
- **Routing classifier** — tier alignment pass
- All quality gates: prettier, typecheck, lint, build, test
- Final review and deploy

## Tier Model (Source of Truth)

| Tier | Price | Self-serve | Description |
|---|---|---|---|
| **Free** | £0 | Yes | Core Axel experience with daily usage caps. 7-day Premium trial available. |
| **Premium** | £49/month | Yes (Stripe) | Full capability — BYOM, deeper integrations, higher volume. |
| **Enterprise** | Contact us | No (sales) | SSO, audit logs, SLA, custom retention, dedicated support. |

## OpenClaw Integration Model

Axel is OpenClaw-as-a-Service. Each user gets a provisioned OpenClaw container with:
- Workspace files (SOUL.md, USER.md, MEMORY.md, AGENTS.md, TOOLS.md, HEARTBEAT.md)
- Tier-specific `openclaw.json` config (model routing, gateway settings)
- MCP-based skills for integrations (every OpenClaw skill is an MCP server)
- Channel connections (Telegram, Slack, email, webchat, etc.)

The Axel SaaS frontend is the management layer — onboarding, integration setup, credential vault, task visibility, billing. OpenClaw handles the actual agent execution.

## Key Architecture Decisions

1. **Frontend is a management layer.** It collects credentials and writes config. OpenClaw does execution.
2. **Credentials encrypted with AES-256-GCM.** Per-environment key, unique IV per credential. Never returned in API responses.
3. **Token usage tracked per-message.** Gateway returns usage block in every chat response. Backend records and enforces caps.
4. **Workspace config sync is fire-and-forget.** Write files, signal reload, don't block on success.
5. **In-memory rate limiting for MVP.** Swap to Redis/DynamoDB post-launch if needed.
6. **Resend for email.** Fire-and-forget, no retry. Replace with SES at scale.

## MVP Deadline

End of week (2026-04-18). Focus on what makes the product usable for early users.
