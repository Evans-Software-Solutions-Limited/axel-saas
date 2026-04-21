# Gateway Contract — Agent Instructions

## Context

This spec defines the API contract between the Axel SaaS backend (your code) and the OpenClaw gateway running in each user's container (Ferenc's code). You are working on the **backend side** of this contract. The container side is Ferenc's responsibility.

The current chat handler already proxies to `${gatewayUrl}/api/chat`. Your job is to tighten the contract: parse usage data, add request tracing, improve error handling, and add health check + config reload utilities.

## Key Files to Modify

| File                                                                     | What to change                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `microservices/core/src/application/chat/chatHandler.ts`                 | Parse usage block, add X-Request-Id, sessionId, improve error mapping |
| `microservices/core/src/application/provisioning/provisioningService.ts` | Add health check utility                                              |

## Key Files to Create

| File                                                          | Purpose                                                                 |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `microservices/core/src/application/gateway/gatewayClient.ts` | Shared gateway HTTP client with timeout, error handling, URL validation |
| `microservices/core/src/application/gateway/gatewayTypes.ts`  | TypeScript types for gateway request/response shapes                    |

## Critical Rule: Usage Block

Every successful `/api/chat` response from the gateway MUST include:

```typescript
type GatewayUsage = {
  inputTokens: number;
  outputTokens: number;
  model: string;
  cacheReadTokens?: number;
};
```

Your code must:

1. Parse this from every chat response
2. Pass it to `usageRepository.recordUsage()` (from token-management spec)
3. If missing: log a warning, still return the message to the user

**Do not fail the chat request if usage data is missing.** The user's experience is more important than our tracking.

## Gateway Client Pattern

Extract a shared gateway client so all gateway calls go through one place:

```typescript
// gatewayClient.ts
export async function callGateway<T>(
  gatewayUrl: string,
  path: string,
  options: {
    method: "GET" | "POST";
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs: number;
  },
): Promise<GatewayResponse<T>> {
  validateGatewayUrl(gatewayUrl); // existing validation

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(`${gatewayUrl}${path}`, {
      method: options.method,
      headers: {
        "Content-Type": "application/json",
        "X-Request-Id": crypto.randomUUID(),
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    // ... parse response
  } finally {
    clearTimeout(timeout);
  }
}
```

## Config Reload is Fire-and-Forget

```typescript
export async function triggerConfigReload(
  gatewayUrl: string,
  reason: string,
  files: string[],
): Promise<void> {
  try {
    await callGateway(gatewayUrl, "/api/reload", {
      method: "POST",
      body: { reason, files },
      timeoutMs: 10_000,
    });
  } catch (error) {
    // Log but don't throw — reload is best-effort
    console.warn(`Config reload failed for ${gatewayUrl}: ${error}`);
  }
}
```

**Never let a failed reload block user-facing operations.** Config catches up on the next OpenClaw heartbeat.

## Testing Notes

- Mock the gateway (don't make real HTTP calls in unit tests)
- Test all error paths: timeout, 429, 500, malformed response, missing usage
- Test URL validation is called for every gateway call
- Test X-Request-Id is generated and sent
- Coverage threshold: 90%
