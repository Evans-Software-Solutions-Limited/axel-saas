# Gateway Contract — Tasks

## Documentation (Share with Ferenc)
- [ ] Finalise this spec and share with Ferenc as the interface contract
- [ ] Agree on gateway endpoint paths and payload shapes
- [ ] Agree on auth mechanism (JWT forwarding + shared secret)
- [ ] Agree on timeout values
- [ ] Document any OpenClaw-specific config needed for gateway endpoints

## Backend — Chat Proxy Updates
- [ ] Update `chatHandler.ts` to expect and parse `usage` block from gateway response
- [ ] Pass `usage` data to token tracking (call `usageRepository.recordUsage()`)
- [ ] Add `X-Request-Id` header to gateway requests (generate UUID per request)
- [ ] Add `sessionId` support: store in chat state, send on subsequent messages
- [ ] Handle missing `usage` block gracefully (log warning, don't fail)
- [ ] Implement 60-second timeout on gateway fetch
- [ ] Improve error handling: map gateway 429 → user 429, gateway 500 → user 502

## Backend — Health Check Integration
- [ ] Create utility `checkContainerHealth(gatewayUrl)` → calls `GET /api/health`
- [ ] Use in agent status endpoint (`GET /users/me/agent`) as secondary signal
- [ ] Use during provisioning polling — health check confirms container is truly ready
- [ ] 5-second timeout, treat timeout as unhealthy

## Backend — Config Reload
- [ ] Create utility `triggerConfigReload(gatewayUrl, reason, files)` → calls `POST /api/reload`
- [ ] Fire-and-forget: log success/failure, don't block caller
- [ ] Call after: integration connect/disconnect, BYOM key change, schedule create/update/delete
- [ ] Handle container not supporting reload (404) — log and move on, config catches up on heartbeat

## Backend — Usage Report Endpoint (Optional)
- [ ] Create `POST /api/usage/report` endpoint (if needed for cron/background task usage)
- [ ] Authenticate via X-Provisioning-Secret
- [ ] Parse entries array, call `usageRepository.recordUsage()` for each
- [ ] Return count of recorded entries
- [ ] **Defer this unless per-message usage tracking proves insufficient**

## Backend — Gateway URL Validation
- [ ] Review existing `validateGatewayUrl()` in chatHandler.ts
- [ ] Ensure it's used consistently for all gateway calls (not just chat)
- [ ] Extract to shared utility if not already

## Container Side (Ferenc's Work — Document Requirements)
- [ ] Container must expose: `POST /api/chat`, `GET /api/health`
- [ ] Container should expose: `POST /api/reload` (nice-to-have for MVP)
- [ ] Container may expose: `GET /api/usage` (nice-to-have)
- [ ] Container must call `POST /provisioning/register` on startup
- [ ] Container must include `usage` block in every chat response
- [ ] Container must validate X-Provisioning-Secret for outbound calls to backend

## Integration Testing
- [ ] Test chat proxy with mock gateway returning usage data
- [ ] Test chat proxy with mock gateway returning no usage block (graceful degradation)
- [ ] Test chat proxy with mock gateway timeout (60s)
- [ ] Test health check with healthy and unhealthy responses
- [ ] Test config reload fire-and-forget (success, failure, 404)
- [ ] Test gateway URL validation (HTTPS enforcement, private IP blocking)

## Quality Gates
- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
