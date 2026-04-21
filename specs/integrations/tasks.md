# Integrations & Credential Management — Tasks

## Database & Schema

- [ ] Add `integration_credentials` table to `packages/db/src/schema.ts`
- [ ] Add `oauth_state` table to `packages/db/src/schema.ts`
- [ ] Create migration for both new tables
- [ ] Add `CREDENTIAL_ENCRYPTION_KEY` SST secret to `infra/secrets.ts`

## Backend — Credential Vault

- [ ] Create `microservices/core/src/application/integrations/` module
- [ ] Implement encryption utilities: `encrypt(plaintext, key)` → `{ encrypted, iv }` and `decrypt(encrypted, iv, key)` using AES-256-GCM
- [ ] Create `integrationRepository.ts` — CRUD for `integration_credentials`
- [ ] Create `oauthStateRepository.ts` — CRUD for `oauth_state` with TTL cleanup
- [ ] Implement `displayHint(value)` — mask credential for safe display (e.g. `sk-...xxxx`)

## Backend — Integration Registry

- [ ] Create `integrationRegistry.ts` — static catalogue of supported integrations with metadata (id, name, description, authType, tierRequired, helpUrl, category)
- [ ] Create `integrationHandler.ts` with routes:
  - [ ] `GET /integrations` — list all integrations with user's connection status
  - [ ] `POST /integrations/:id/connect` — store API key credential
  - [ ] `DELETE /integrations/:id/disconnect` — remove credential
  - [ ] `PUT /integrations/:id/update` — replace credential
- [ ] Mount handler in `api.ts` (protected routes, requires auth)

## Backend — OAuth Flows

- [ ] `GET /integrations/:id/oauth/start` — generate state, store in `oauth_state`, return redirect URL
- [ ] `GET /integrations/:id/oauth/callback` — validate state, exchange code for tokens, encrypt and store
- [ ] Implement Google OAuth (covers Gmail, Calendar, Drive with different scopes)
- [ ] Implement Slack OAuth
- [ ] Add OAuth client IDs/secrets as SST secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`

## Backend — Workspace Propagation

- [ ] After credential change, update user's workspace `TOOLS.md` with connected integrations
- [ ] After credential change, update user's `openclaw.json` with MCP skill config (for tool integrations) or channel config (for communication channels)
- [ ] Implement container config reload signal (POST to gateway `/api/reload` or filesystem watch trigger)

## Frontend — Integrations Page

- [ ] Rewrite `packages/web/src/pages/Integrations.tsx` — replace hardcoded list with API-driven data
- [ ] Create `integrationsApi.ts` — eden client calls for integration endpoints
- [ ] Implement integration card component with status states (connected, disconnected, error, locked, coming-soon)
- [ ] Categorise integrations: Communication, Tools, AI Models
- [ ] Show tier-gating (lock icon + "Upgrade" for Premium-only integrations on Free tier)

## Frontend — Connect Modals

- [ ] Create `ConnectApiKeyModal` component — masked input, help text, submit handler
- [ ] Create `ManageIntegrationModal` component — shows masked credential, disconnect/update buttons
- [ ] Create `DisconnectConfirmDialog` component
- [ ] Implement OAuth redirect flow — call `/oauth/start`, redirect, handle callback return with URL params

## Frontend — BYOM Section

- [ ] Add "AI Models" category section (Premium only)
- [ ] Show upgrade prompt for Free tier users
- [ ] Model provider cards (OpenAI, Anthropic)
- [ ] After connecting BYOM key, show model selector dropdown

## Frontend — Help Text

- [ ] Write help content for each MVP integration:
  - [ ] Telegram: @BotFather steps
  - [ ] Notion: internal integration setup
  - [ ] Gmail/Calendar: "Click Connect" (OAuth)
  - [ ] Slack: "Click Connect" (OAuth)
  - [ ] OpenAI: where to find API key
  - [ ] Anthropic: where to find API key

## Tests

- [ ] Unit tests for encryption utilities (encrypt/decrypt roundtrip, unique IVs)
- [ ] Unit tests for integrationRepository (CRUD, unique constraint)
- [ ] Unit tests for integrationHandler (connect, disconnect, list with status)
- [ ] Unit tests for OAuth state management (create, validate, expire)
- [ ] Frontend tests for connect modal (submit, validation, masking)
- [ ] Frontend tests for integrations page (render categories, status indicators)

## Quality Gates

- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
