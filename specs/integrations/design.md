# Integrations & Credential Management — Design

## Overview

Axel is OpenClaw-as-a-Service. OpenClaw uses **MCP-based skills** for integrations — every skill is an MCP server. OpenClaw supports 23+ communication channels and 5,700+ community skills on ClawHub.

Our job is to give non-technical users a **UI to connect their tools** and securely provide credentials that get injected into their OpenClaw workspace config.

## Architecture

```
User (frontend)
  → Provides credentials / completes OAuth
    → Backend stores encrypted credentials
      → Backend writes to user's workspace TOOLS.md + openclaw.json
        → OpenClaw container picks up config and connects
```

The frontend is a **management layer**. It does not run integrations — it configures them. OpenClaw does the actual connecting.

## Integration Categories

### Communication Channels (OpenClaw built-in)

These are OpenClaw's native channels. Each needs platform-specific credentials.

| Channel             | Auth Type     | Credential Required                      | MVP        |
| ------------------- | ------------- | ---------------------------------------- | ---------- |
| **Telegram**        | Bot token     | `TELEGRAM_BOT_TOKEN`                     | Yes        |
| **Slack**           | OAuth 2.0     | OAuth app install → token                | Yes        |
| **Email (Gmail)**   | OAuth 2.0     | Google OAuth → refresh token             | Yes        |
| **Google Calendar** | OAuth 2.0     | Google OAuth (same consent as Gmail)     | Yes        |
| **WhatsApp**        | Phone pairing | QR code / phone number                   | Post-MVP   |
| **Discord**         | Bot token     | `DISCORD_BOT_TOKEN`                      | Post-MVP   |
| **Microsoft Teams** | OAuth 2.0     | Azure AD app                             | Post-MVP   |
| **WebChat**         | Built-in      | No credential needed (gateway serves it) | Yes (free) |

### Tool Integrations (MCP Skills)

| Integration        | Auth Type             | Credential Required                           | MVP      |
| ------------------ | --------------------- | --------------------------------------------- | -------- |
| **Notion**         | API key               | `NOTION_API_KEY` (internal integration token) | Yes      |
| **Google Drive**   | OAuth 2.0             | Same Google OAuth consent                     | Yes      |
| **GitHub**         | Personal access token | `GITHUB_TOKEN`                                | Post-MVP |
| **Linear**         | API key               | `LINEAR_API_KEY`                              | Post-MVP |
| **Custom webhook** | URL + optional secret | `WEBHOOK_URL`, `WEBHOOK_SECRET`               | Post-MVP |

### BYOM (Bring Your Own Model) — Premium only

| Provider            | Credential          | MVP      |
| ------------------- | ------------------- | -------- |
| **OpenAI**          | `OPENAI_API_KEY`    | Yes      |
| **Anthropic**       | `ANTHROPIC_API_KEY` | Yes      |
| **Google (Gemini)** | `GOOGLE_AI_API_KEY` | Post-MVP |

## Credential Storage

### Security Model

1. **Frontend** collects credentials via form input (API keys) or OAuth redirect (tokens)
2. **Transport**: HTTPS only, credentials in request body (never URL params)
3. **Backend** encrypts at rest using AES-256-GCM with a per-environment encryption key
4. **Storage**: `integration_credentials` table — encrypted blob, never returned in full
5. **Frontend display**: masked value only (`sk-...xxxx`, `bot12345...xxxx`)
6. **Deletion**: hard delete from DB, propagate removal to workspace config
7. **No credential ever appears in logs, error messages, or API responses**

### Database Schema

```sql
-- New table
CREATE TABLE integration_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,        -- e.g. "telegram", "notion", "openai"
  credential_type TEXT NOT NULL,       -- "api_key", "oauth_token", "bot_token"
  encrypted_value BYTEA NOT NULL,      -- AES-256-GCM encrypted
  iv BYTEA NOT NULL,                   -- Initialisation vector
  display_hint TEXT,                   -- Masked preview: "sk-...xxxx"
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  connected_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,             -- For OAuth tokens with expiry
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, integration_id)
);

-- New table for OAuth state
CREATE TABLE oauth_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration_id TEXT NOT NULL,
  state_token TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL      -- Short TTL, 10 minutes
);
```

### Encryption

- Key source: SST secret `CREDENTIAL_ENCRYPTION_KEY` (32-byte AES key)
- Algorithm: AES-256-GCM (authenticated encryption)
- Each credential gets a unique random IV
- Key rotation: re-encrypt all credentials when key changes (migration script)

## API Endpoints

### Integration Registry

```
GET /integrations
  → Returns list of available integrations with:
    - id, name, description, icon, auth_type, tier_required
    - For authenticated user: connection_status, connected_at, display_hint
```

### Credential Management

```
POST /integrations/:integrationId/connect
  Body: { credential: "sk-..." }  (for API key types)
  → Encrypts and stores credential
  → Writes to workspace config
  → Returns: { status: "connected", displayHint: "sk-...xxxx" }

DELETE /integrations/:integrationId/disconnect
  → Hard deletes credential
  → Removes from workspace config
  → Returns: { status: "disconnected" }
```

### OAuth Flow

```
GET /integrations/:integrationId/oauth/start
  → Generates state token, stores in oauth_state
  → Returns: { redirectUrl: "https://accounts.google.com/..." }

GET /integrations/:integrationId/oauth/callback?code=...&state=...
  → Validates state token
  → Exchanges code for tokens
  → Encrypts and stores tokens
  → Redirects to frontend /dashboard/integrations?connected=:integrationId
```

### Workspace Propagation

When a credential is added/removed, the backend must:

1. Update the user's workspace `TOOLS.md` with the integration status
2. Update the user's `openclaw.json` with the MCP skill config or channel config
3. Signal the container to reload config (via gateway API or file watch)

## Frontend UI

### Integrations Page (`/dashboard/integrations`)

```
┌─────────────────────────────────────────────┐
│  Integrations                               │
│  Connect the tools Axel needs to help you   │
│                                             │
│  ┌─── Communication ───────────────────┐    │
│  │ [Telegram]  [Slack]  [Gmail]        │    │
│  │ [WebChat]   [WhatsApp🔒]            │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─── Tools ──────────────────────────┐     │
│  │ [Google Calendar]  [Notion]         │    │
│  │ [Google Drive]     [GitHub🔒]       │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─── AI Models (Premium) ────────────┐     │
│  │ [OpenAI]  [Anthropic]  [Gemini🔒]  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

Each integration card shows:

- Icon + name
- Connection status (green dot = connected, grey = not connected, red = error)
- "Connect" / "Manage" / "Upgrade to unlock" button
- 🔒 for post-MVP or tier-locked integrations

### Connect Modal (API Key type)

```
┌─────────────────────────────────────┐
│  Connect Telegram                   │
│                                     │
│  To connect Telegram, you'll need   │
│  a bot token from @BotFather.       │
│  [How to get a bot token →]         │
│                                     │
│  Bot token                          │
│  ┌─────────────────────────────┐    │
│  │ ••••••••••••••••••••••••••  │    │
│  └─────────────────────────────┘    │
│  Your token is encrypted and never  │
│  stored in plain text.              │
│                                     │
│  [Cancel]            [Connect]      │
└─────────────────────────────────────┘
```

### Connect Flow (OAuth type)

1. User clicks "Connect Gmail"
2. Frontend calls `GET /integrations/gmail/oauth/start`
3. Frontend redirects to Google consent screen
4. Google redirects back to our callback URL
5. Backend stores tokens, redirects to frontend
6. Frontend shows "Gmail connected" state

### Manage Modal (Connected)

```
┌─────────────────────────────────────┐
│  Telegram  ● Connected              │
│  Connected 3 days ago               │
│                                     │
│  Token: bot123456...xxxx            │
│                                     │
│  [Disconnect]    [Update token]     │
└─────────────────────────────────────┘
```
