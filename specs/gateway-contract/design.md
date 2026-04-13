# Gateway Contract — Design

## Overview

The Gateway Contract defines the API surface between the Axel SaaS backend and the OpenClaw gateway running inside each user's provisioned container. This is the **shared interface** between Bradley's backend work and Ferenc's IAC/provisioning work.

Currently the chat handler proxies to `${gatewayUrl}/api/chat` and the provisioning handler receives registration at `POST /provisioning/register`. But the full bidirectional contract is implicit. This spec makes it explicit.

## Architecture

```
┌─────────────────────────┐          ┌───────────────────────────────┐
│  Axel SaaS Backend      │          │  User Container (OpenClaw)    │
│  (Lambda / Elysia)      │          │  (ECS / Docker)               │
│                         │          │                               │
│  Chat Handler ──────────┼── POST → │  /api/chat                    │
│  Config Sync ───────────┼── POST → │  /api/reload                  │
│  Health Check ──────────┼── GET ──→│  /api/health                  │
│  Usage Query ───────────┼── GET ──→│  /api/usage                   │
│                         │          │                               │
│  Provisioning Register ←┼── POST ──│  (container startup callback) │
│  Usage Webhook ─────────┼←─ POST ──│  /api/usage/report (optional) │
└─────────────────────────┘          └───────────────────────────────┘
```

## Gateway Endpoints (Container → exposed to Backend)

These endpoints run inside the user's container. The backend calls them.

### POST /api/chat — Send a message to the agent

**Request:**

```json
{
  "message": "Summarise my emails from today",
  "userId": "uuid",
  "sessionId": "uuid (optional — for conversation continuity)"
}
```

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <user-jwt> (forwarded from original request)
X-Request-Id: <uuid> (for tracing)
```

**Response (200):**

```json
{
  "response": "Here's a summary of your 5 emails today...",
  "messageId": "uuid",
  "sessionId": "uuid",
  "usage": {
    "inputTokens": 1250,
    "outputTokens": 840,
    "model": "anthropic/haiku",
    "cacheReadTokens": 0
  }
}
```

**Response (429 — agent-side rate limit):**

```json
{
  "error": "rate_limited",
  "message": "Agent is processing another request. Please wait.",
  "retryAfter": 5
}
```

**Response (500 — agent error):**

```json
{
  "error": "agent_error",
  "message": "Failed to process message",
  "details": "optional debug info (non-production only)"
}
```

**Key contract points:**

- `usage` block is **mandatory** in every successful response — the backend needs it for token tracking
- `model` tells us which model was actually used (may differ from config if OpenClaw routes internally)
- `sessionId` enables conversation continuity across messages

### GET /api/health — Container health check

**Response (200):**

```json
{
  "status": "healthy",
  "agentReady": true,
  "uptime": 3600,
  "lastActivity": "2026-04-13T14:23:00Z"
}
```

**Response (503):**

```json
{
  "status": "unhealthy",
  "agentReady": false,
  "reason": "workspace not loaded"
}
```

**Used for:** Backend polling during provisioning, periodic health checks, auto-recovery triggers.

### POST /api/reload — Reload workspace config

Called when integrations, BYOM keys, or schedules change. Tells the container to re-read workspace files.

**Request:**

```json
{
  "reason": "integration_added",
  "files": ["TOOLS.md", "openclaw.json"]
}
```

**Response (200):**

```json
{
  "status": "reloaded",
  "filesReloaded": ["TOOLS.md", "openclaw.json"]
}
```

**Response (409 — agent busy):**

```json
{
  "status": "deferred",
  "message": "Agent is mid-task. Reload queued for after completion."
}
```

**Key contract points:**

- Reload is **best-effort**. If the container is busy, it queues the reload.
- The `files` array tells the container which files changed (optimisation — it can skip re-reading unchanged files).
- If the container doesn't support `/api/reload`, the fallback is that OpenClaw reads workspace files on each new session/heartbeat (slower but functional).

### GET /api/usage — Query current token usage

**Response (200):**

```json
{
  "today": {
    "inputTokens": 12500,
    "outputTokens": 6200,
    "model": "anthropic/haiku",
    "requestCount": 15
  },
  "session": {
    "inputTokens": 3200,
    "outputTokens": 1800
  }
}
```

**Used for:** Syncing usage data if the backend's own tracking diverges from what OpenClaw reports. Secondary source — primary tracking is in our `token_usage` table from per-message `usage` blocks.

## Backend Endpoints (Backend → exposed to Container)

These endpoints run in the Axel SaaS backend. The container calls them.

### POST /provisioning/register — Container startup callback

**Already exists.** Container calls this when ready to serve traffic.

**Request:**

```json
{
  "userId": "uuid",
  "gatewayUrl": "https://container-123.internal:18789"
}
```

**Headers:**

```
Content-Type: application/json
X-Provisioning-Secret: <shared-secret>
```

**Response (200):**

```json
{
  "status": "registered"
}
```

### POST /api/usage/report — Usage reporting webhook (optional)

If OpenClaw supports pushing usage data (rather than us pulling from each `/api/chat` response), the container can POST usage batches to us.

**Request:**

```json
{
  "userId": "uuid",
  "entries": [
    {
      "timestamp": "2026-04-13T14:23:00Z",
      "model": "anthropic/haiku",
      "inputTokens": 1250,
      "outputTokens": 840,
      "source": "chat",
      "sessionId": "uuid"
    }
  ]
}
```

**Headers:**

```
Content-Type: application/json
X-Provisioning-Secret: <shared-secret>
```

**Response (200):**

```json
{
  "status": "recorded",
  "count": 1
}
```

**MVP note:** This is optional. If per-message `usage` blocks in `/api/chat` responses are reliable, we don't need a separate push endpoint. Implement only if token tracking from chat responses proves insufficient (e.g. for cron-triggered tasks where there's no chat response to read).

## Authentication Between Services

| Direction                          | Auth Mechanism                                       |
| ---------------------------------- | ---------------------------------------------------- |
| Backend → Container                | Forward user's Bearer JWT + X-Request-Id for tracing |
| Container → Backend (register)     | X-Provisioning-Secret shared secret                  |
| Container → Backend (usage report) | X-Provisioning-Secret shared secret                  |

**Security rules:**

- Gateway URLs validated: HTTPS-only in production, no private IPs
- Shared secret rotatable via SST secret
- User JWT forwarded but NOT verified by the container (the backend already verified it)

## Error Handling & Resilience

| Scenario                               | Backend Behaviour                                                       |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Container unreachable (network)        | Return 503 to user, retry once after 1s                                 |
| Container returns 500                  | Return 502 to user, log error, mark task as failed                      |
| Container returns 429                  | Return 429 to user with retry-after                                     |
| Container returns unexpected format    | Return 502, log malformed response for debugging                        |
| Usage block missing from chat response | Log warning, still return message to user, skip usage recording         |
| Reload fails                           | Log warning, no user-facing error (config catches up on next heartbeat) |

## Timeout Policy

| Endpoint         | Timeout | Rationale                         |
| ---------------- | ------- | --------------------------------- |
| POST /api/chat   | 60s     | Agent may do multi-step reasoning |
| GET /api/health  | 5s      | Should be instant                 |
| POST /api/reload | 10s     | File re-read, not heavy           |
| GET /api/usage   | 5s      | Simple aggregation                |

## Versioning

No versioning for MVP. If the contract changes post-launch, add `X-Gateway-Version` header so backend can handle multiple container versions during rolling deploys.
