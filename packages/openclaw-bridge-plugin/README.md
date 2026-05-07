# `@axel-saas/openclaw-bridge-plugin`

OpenClaw plugin that exposes Axel's [gateway-contract](../../specs/gateway-contract/design.md) REST surface inside the per-user OpenClaw container.

## What it does

Registers four HTTP routes on the OpenClaw gateway via the documented `api.registerHttpRoute(...)` plugin SDK:

| Method | Path          | Behaviour                                                                                                                                                                                                                                                                                                    |
| ------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST` | `/api/chat`   | Translates `{message, userId, sessionId?}` → OpenClaw's first-party `POST /v1/chat/completions`, then reshapes the OpenAI-shaped response (`choices`, `usage`) back into Axel's gateway-contract shape (`response`, `messageId`, `sessionId`, `usage: {inputTokens, outputTokens, model, cacheReadTokens}`). |
| `GET`  | `/api/health` | Proxies OpenClaw's `/healthz` and reshapes to gateway-contract `{status, agentReady, uptime, lastActivity}`. Returns 503 with a `reason` on upstream failure.                                                                                                                                                |
| `POST` | `/api/reload` | **MVP:** acknowledges with `202 deferred`. Real reload semantics land with `feat/workspace-config-sync` once the SDK's `api.registerReload(...)` is wired.                                                                                                                                                   |
| `GET`  | `/api/usage`  | **MVP:** returns zero counters. Canonical token usage lives in the backend's `token_usage` table from per-`/api/chat` `usage` blocks (PR #96); this endpoint is a reconciliation fallback.                                                                                                                   |

All four routes use `auth: "gateway"`, so OpenClaw enforces the gateway token (PR #98's `gatewayClient.ts` already sends `Authorization: Bearer ...`).

## How it loads

The Dockerfile in `docker/openclaw/` copies the built `dist/` plus the manifests into the image and runs `openclaw plugins install /opt/axel-bridge --link`. The workspace templates (`openclaw-{free,premium,enterprise}.json`) enable the plugin in `plugins.entries.axel-bridge` and turn on OpenClaw's chat-completions endpoint in `gateway.http.endpoints.chatCompletions`.

## Why a plugin and not a sidecar

Originally framed as a "REST→WS sidecar shim" in the post-#98 handoff. A pre-build spike found:

1. OpenClaw's WS protocol is **challenge-response** (nonce + signed reply), not bearer-token — implementing it from outside would mean reverse-engineering an undocumented private wire format.
2. OpenClaw ships a documented [plugin SDK](https://docs.openclaw.ai/plugins/) with a generic `api.registerHttpRoute(...)` surface, so we can register our routes inside the gateway process without going over WS at all.
3. OpenClaw also ships a built-in `POST /v1/chat/completions` endpoint (OpenAI-compatible), gated behind `gateway.http.endpoints.chatCompletions.enabled`. The plugin reaches this on loopback rather than re-implementing chat dispatch.

Net: ~300 lines of plugin code on a documented extension surface, not ~300 lines of WS-shim driving a private protocol. Full ADR in the PR description that landed this package.

## Local development

```bash
bun install
bun run typecheck      # tsc --noEmit
bun run test:unit      # vitest run --coverage (90% threshold enforced)
bun run build          # bundles src/ → dist/ via bun build, externalising openclaw
```

The build step is required before `docker compose build` in `docker/openclaw/` — the Dockerfile copies `dist/` into the image.
