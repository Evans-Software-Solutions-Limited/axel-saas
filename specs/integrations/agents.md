# Integrations & Credential Management — Agent Instructions

## Context

Axel uses OpenClaw under the hood. Every OpenClaw integration is an MCP server (skill). The Axel frontend is a management layer that lets non-technical users connect their tools by providing credentials. Those credentials get encrypted, stored, and injected into the user's OpenClaw workspace config.

## Key Architectural Decision

**The frontend never runs integrations.** It only:
1. Collects credentials (API keys via form, OAuth tokens via redirect)
2. Sends them to the backend for encrypted storage
3. Displays connection status

**The backend:**
1. Encrypts credentials with AES-256-GCM (per-environment key from SST secret)
2. Stores in `integration_credentials` table
3. Propagates config to user's OpenClaw workspace (TOOLS.md + openclaw.json)

**OpenClaw:**
1. Reads workspace config
2. Connects to services using the credentials
3. Handles the actual integration work

## Key Files to Create

| File | Purpose |
|---|---|
| `microservices/core/src/application/integrations/integrationHandler.ts` | Elysia route handler |
| `microservices/core/src/application/integrations/integrationRegistry.ts` | Static catalogue of integrations |
| `microservices/core/src/application/integrations/integrationRepository.ts` | DB access for credentials |
| `microservices/core/src/application/integrations/oauthStateRepository.ts` | OAuth state management |
| `microservices/core/src/application/integrations/encryption.ts` | AES-256-GCM encrypt/decrypt |
| `packages/web/src/pages/Integrations.tsx` | Rewrite existing page |
| `packages/web/src/pages/integrations/integrationsApi.ts` | API client |
| `packages/web/src/pages/integrations/ConnectApiKeyModal.tsx` | Credential input modal |
| `packages/web/src/pages/integrations/ManageIntegrationModal.tsx` | View/disconnect modal |

## Key Files to Modify

| File | What to change |
|---|---|
| `packages/db/src/schema.ts` | Add `integrationCredentials` and `oauthState` tables |
| `microservices/core/src/api.ts` | Mount integration handler |
| `infra/api.ts` | Add encryption key + OAuth client env vars |
| `infra/secrets.ts` | Add `CREDENTIAL_ENCRYPTION_KEY` secret |

## Security Rules — Non-Negotiable

1. **Never return full credentials in API responses.** Only return `displayHint` (masked).
2. **Never log credentials.** Not in error handlers, not in debug output, not anywhere.
3. **AES-256-GCM with unique IV per credential.** Do not reuse IVs.
4. **Hard delete on disconnect.** No soft delete, no tombstones.
5. **OAuth state tokens expire after 10 minutes.** Clean up expired entries.
6. **HTTPS only for credential transport.** Reject HTTP in production.
7. **Validate credential format before storing** (e.g. Telegram bot tokens match pattern `\d+:[A-Za-z0-9_-]+`).

## OpenClaw Config Format

When writing to a user's OpenClaw workspace, the config for an MCP skill looks like:

```json
// In openclaw.json under agents.defaults.skills or similar
{
  "skills": {
    "telegram": {
      "type": "stdio",
      "command": "openclaw-skill-telegram",
      "env": {
        "TELEGRAM_BOT_TOKEN": "<decrypted-at-runtime>"
      }
    }
  }
}
```

For channels, it's configured in the `channels` section of `openclaw.json`. Refer to OpenClaw docs for exact format.

**Important:** Credentials must be decrypted and written to the workspace config file (which is on encrypted EFS storage within the user's container). The credential is encrypted in our DB and decrypted only when writing to the workspace.

## Testing Notes

- Test encryption roundtrip: encrypt → decrypt → compare
- Test unique IV generation (no two encryptions produce same IV)
- Test displayHint masking for various credential formats
- Test OAuth state expiry
- Test that API never returns `encrypted_value` or `iv` fields
- Mock the encryption key in tests (don't use real secrets)
- Coverage threshold: 90%

## Order of Operations

1. DB schema + migration first
2. Encryption utilities (testable in isolation)
3. Repository layer
4. Handler + routes
5. Frontend page rewrite
6. OAuth flows (most complex — do last)
