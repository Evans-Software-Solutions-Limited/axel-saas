# Refactor roadmap

This document tracks a **step-by-step** refactor: small PRs, green main after each merge, one primary axis per change where possible.

**Collaboration:** Use **Conventional Commits**, a **branch per task**, and **one PR per task**. Details for humans and AI assistants live in [`.cursor/rules/git-and-pr-workflow.mdc`](../.cursor/rules/git-and-pr-workflow.mdc).

---

## Decisions (locked before implementation)

| #   | Topic                         | Decision                                                                                                                                                                                                                                                        |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Web origins**               | **Separate origins:** `www` (marketing / public site) and `app` (logged-in dashboard).                                                                                                                                                                          |
| 2   | **API compute**               | **One Lambda per Hono app** — each deployable API is a single Lambda handling **multiple routes** (standard Hono mounting).                                                                                                                                     |
| 3   | **Typed client after Elysia** | **OpenAPI-first Hono** (`@hono/zod-openapi` or hand-maintained OpenAPI) + generated or hand-written client types in shared packages — see [§ Client strategy](#client-strategy-post-elysia). Eden is removed with Elysia.                                       |
| 4   | **SST / deployments**         | **Each SST deployment is separate.** No runtime or infra dependencies **between** apps (e.g. marketing must not import another app’s stack outputs). **Shared packages** (`packages/db`, `packages/api-utils`, config packages, UI) are allowed and encouraged. |

---

## Client strategy (post-Elysia)

**Recommendation:** Treat the public and dashboard APIs as **two OpenAPI-documented Hono apps**. Publish or generate types from OpenAPI into `@axel-saas/api-client-public` and `@axel-saas/api-client-dashboard` (names TBD), or a single package with two entrypoints — whichever keeps imports clear for `www` vs `app`.

- **Pros:** Clear contracts, language-agnostic, works with separate SST projects.
- **Alternatives rejected for now:** tRPC (couples stacks), raw `fetch` without spec (loses safety).

Revisit once the first Hono-only handler set is stable.

---

## Guiding principles

1. **One axis per PR** where possible (tooling vs layout vs runtime vs product split).
2. **Mechanical moves before semantic changes** (paths and names before new behavior).
3. **Green main after each merge** — typecheck, lint, tests, deploy smoke as applicable.
4. **Rollback-friendly** — each PR should be revertible without losing unrelated work.

---

## Phase A — Tooling baseline

| Step | Task                           | Notes                                                                                                                          |
| ---- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| A1   | Pin Node                       | `engines` in root `package.json`, `.nvmrc` / `.node-version`, CI and Docker aligned.                                           |
| A2   | Exact dependency versions      | Project-wide policy (Bun lockfile + save-exact or equivalent). Fix Turbo `globalDependencies` to match the real lockfile name. |
| A3   | `@axel-saas/typescript-config` | Shared tsconfig bases; migrate **one** workspace per PR until done.                                                            |
| A4   | `@axel-saas/eslint-config`     | Same incremental migration.                                                                                                    |

**PR sizing:** A1–A2 can be one or two small PRs. A3 and A4 are often separate PRs.

---

## Phase B — Component library

| Step | Task                             | Notes                                                                          |
| ---- | -------------------------------- | ------------------------------------------------------------------------------ |
| B1   | `@axel-saas/ui` (or agreed name) | Tokens + primitives; align with existing patterns.                             |
| B2   | Wire **one** consumer first      | Prove build, tests, and consumption from `www` or `app` before bulk migration. |

Expand usage in follow-up PRs; avoid one mega-migration.

---

## Phase C — Monorepo layout: `apps/`, remove `microservices/`

| Step | Task                                                | Notes                                                                       |
| ---- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| C1   | Move API code out of `microservices/` into `apps/…` | Mechanical; update handler paths in SST for **that** app’s deployment only. |
| C2   | Move `packages/web` toward `apps/…`                 | May stay a single app until Phase D; paths and workspace names updated.     |
| C3   | Keep shared code in `packages/*`                    | `db`, `api-utils`, configs, UI — no app-to-app imports.                     |
| C4   | Remove empty `microservices/`                       | Docs updated.                                                               |

**Scope:** Layout and references only — **no** marketing vs dashboard split yet if that keeps the PR smaller.

---

## Phase D — Split web: `www` vs `app`

Aligned with **separate origins**.

| Step | Task                                                       | Notes                                                                            |
| ---- | ---------------------------------------------------------- | -------------------------------------------------------------------------------- |
| D1   | Two Vite apps (or two entries) under `apps/`               | e.g. `apps/www`, `apps/app` — names TBD.                                         |
| D2   | Shared UI + tokens via `@axel-saas/ui` and shared packages | No `apps/www` importing `apps/app` or vice versa.                                |
| D3   | Move routes incrementally                                  | Marketing first, then dashboard; each merge leaves both buildable.               |
| D4   | Env and auth                                               | Per-origin `VITE_*`, cookie/domain strategy for Supabase across `www` and `app`. |

---

## Phase E — Split API: public vs dashboard

Aligned with **one Lambda per Hono app** and **separate SST deployments**.

| Step | Task                                    | Notes                                                                                  |
| ---- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| E1   | Route inventory                         | Public vs authenticated; webhooks documented.                                          |
| E2   | Two Hono apps in **two** code locations | e.g. `apps/api-public`, `apps/api-dashboard` — each one Lambda, many routes.           |
| E3   | **Separate SST project per app**        | No stack output coupling between apps; env and secrets per deployment.                 |
| E4   | Clients                                 | Two client entrypoints or packages consuming the two OpenAPI surfaces (see decisions). |

Optional intermediate step: implement both Hono apps in repo **before** cutting second deployment, if that reduces risk — still no cross-app infra dependencies.

---

## Phase F — Remove Elysia; Hono only

| Step | Task                                               | Notes                                                |
| ---- | -------------------------------------------------- | ---------------------------------------------------- |
| F1   | OpenAPI + client path agreed                       | Per [Client strategy](#client-strategy-post-elysia). |
| F2   | Migrate handlers domain-by-domain                  | Tests green after each slice.                        |
| F3   | Remove Elysia, Eden, and unused `@elysiajs/*` deps | Update imports in `www` / `app` clients.             |

Order relative to Phase E: can migrate **one** API app to Hono-only first, then the other, or both in sequence — avoid a single huge diff.

---

## Phase G — Infrastructure per app

Aligned with **separate SST deployments** and **no dependencies between apps**.

| Step | Task                                                    | Notes                                                                  |
| ---- | ------------------------------------------------------- | ---------------------------------------------------------------------- |
| G1   | Each app owns its `sst.config.ts` (or equivalent entry) | Deploy from app directory or documented root script targeting one app. |
| G2   | Colocate infra next to code                             | Routes, env, secrets scoped to that Lambda + static site as needed.    |
| G3   | Document deploy matrix                                  | Which repo paths map to `www`, `app`, `api-public`, `api-dashboard`.   |

Shared packages only — never `import` another app’s SST constructs.

---

## Phase H — Git hooks and quality gates

| Step | Task                | Notes                                                                                                       |
| ---- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| H1   | Husky + lint-staged | ESLint / Prettier on changed files.                                                                         |
| H2   | Typecheck           | Prefer **CI** or **pre-push** if full `tsc` is slow.                                                        |
| H3   | Tests               | Pre-push or CI for `turbo run test:unit`; avoid blocking every commit with full suite unless team wants it. |
| H4   | Coverage thresholds | **CI** as the gate; optional local scripts.                                                                 |

---

## Dependency overview

```
A (node + pins + ts/eslint configs)
  → B (component library)
  → C (apps/ layout, retire microservices/)
    → D (www vs app web)
    → E (public vs dashboard API + separate SST per app)
    → F (Hono-only, drop Elysia)
  → G (infra colocation — follows C and app boundaries)
  → H (husky — after A at minimum; stricter gates once lint/tsconfig stable)
```

**Note:** F can be interleaved with E (e.g. Hono-only for one API first, then split deployments).

---

## Suggested PR sequence (example)

1. Pin Node + exact deps + Turbo lockfile fix
2. `typescript-config` + migrate one package
3. `eslint-config` + migrate one package
4. Scaffold `@axel-saas/ui` + one consumer
5. Move to `apps/` + remove `microservices/` (mechanical)
6. Split `www` vs `app` (incremental)
7. Split API into two Hono apps + two SST projects
8. Elysia removal + OpenAPI + client packages
9. Infra documentation and per-app deploy scripts
10. Husky + CI quality gates

Adjust numbering as you execute; check off steps in this doc or in linked issues.

---

## Risks and mitigations

| Risk                          | Mitigation                                                     |
| ----------------------------- | -------------------------------------------------------------- |
| Cross-origin auth (Supabase)  | Document cookie/session and redirect flow early in Phase D.    |
| Duplicate DB migrations       | Single `packages/db` owner; both APIs use shared package only. |
| Two SST projects drifting     | Version shared packages; CI tests both deploy paths on main.   |
| Large Elysia → Hono migration | Domain-by-domain PRs; keep tests per handler group.            |

---

## Progress log

_Use this section to record completed steps and PR links as you go._

| Date       | Phase | Step  | PR / notes                                                                                                                         |
| ---------- | ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-27 | A     | A1–A2 | [#67](https://github.com/Evans-Software-Solutions-Limited/axel-saas/pull/67) — Node 22 pin, exact install policy, Turbo `bun.lock` |
| 2026-03-27 | A     | A3    | [#68](https://github.com/Evans-Software-Solutions-Limited/axel-saas/pull/68) — `typescript-config`; first consumer `api-utils`     |
| 2026-03-27 | A     | A4    | [#69](https://github.com/Evans-Software-Solutions-Limited/axel-saas/pull/69) — `eslint-config`; first consumer `api-utils`         |
| 2026-03-27 | A     | A3–A4 | [#70](https://github.com/Evans-Software-Solutions-Limited/axel-saas/pull/70) — migrate `db`, `core`, `web` to shared TS + ESLint   |
| 2026-03-27 | B     | B1–B2 | `@axel-saas/ui` (`cn`) + `packages/web` consumer — PR pending                                                                      |
