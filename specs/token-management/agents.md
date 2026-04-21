# Token Management & Cost Control — Agent Instructions

## Context

Axel absorbs AI token costs and offers flat-rate subscriptions. We need to track per-user token usage and enforce daily (Free) or monthly (Premium) caps to protect unit economics. This is critical to the business model.

Refer to `docs/model-routing-and-cost-policy.md` for the strategic background on cost lanes.

## Key Files to Create

| File                                                          | Purpose                    |
| ------------------------------------------------------------- | -------------------------- |
| `microservices/core/src/application/usage/usageRepository.ts` | DB access for token_usage  |
| `microservices/core/src/application/usage/usageService.ts`    | Cap checking logic         |
| `microservices/core/src/application/usage/usageHandler.ts`    | API routes for usage data  |
| `packages/web/src/components/UsageBar.tsx`                    | Usage indicator component  |
| `packages/web/src/pages/chat/RateLimitBanner.tsx`             | In-chat rate limit message |

## Key Files to Modify

| File                                                     | What to change                              |
| -------------------------------------------------------- | ------------------------------------------- |
| `packages/db/src/schema.ts`                              | Add token_usage and usage_caps tables       |
| `microservices/core/src/application/chat/chatHandler.ts` | Check usage before processing, record after |
| `microservices/core/src/api.ts`                          | Mount usage handler                         |
| `packages/web/src/pages/Settings.tsx`                    | Add usage section to billing                |
| `packages/web/src/pages/Dashboard.tsx`                   | Add usage bar for free tier                 |

## Usage Recording Pattern

```typescript
// After chat message processed
await usageRepository.recordUsage({
  userId,
  date: new Date().toISOString().split("T")[0], // YYYY-MM-DD
  model: "anthropic/haiku",
  inputTokens: response.usage.input_tokens,
  outputTokens: response.usage.output_tokens,
  source: "chat",
});
```

Use UPSERT with increment — don't create a new row per message. Aggregate by user + date + model + source.

## Cap Checking Pattern

```typescript
// Before processing chat message
const usage = await usageService.checkUsage(userId, userTier);
if (!usage.allowed) {
  return {
    status: 429,
    body: {
      error: "usage_limit_reached",
      message: "You've reached your daily limit. It resets at midnight UTC.",
      resetAt: usage.resetAt,
      tier: userTier,
    },
  };
}
```

## Rules

1. **Free tier: daily caps.** Check input + output separately. Either hitting the cap blocks usage.
2. **Premium tier: monthly caps.** No daily limit. Warning at 80%.
3. **BYOM: no platform caps.** Still track usage for visibility.
4. **Usage recording is non-blocking.** If recording fails, don't block the chat response. Log and move on.
5. **Caps are configurable via `usage_caps` table.** Don't hardcode values in application code.
6. **429 responses must be handled gracefully in the frontend.** Show inline banner, not a browser error.
7. **Reset time is midnight UTC.** Keep it simple for MVP.

## Cost Model (for reference)

| Model         | Input (per 1M) | Output (per 1M) |
| ------------- | -------------- | --------------- |
| Claude Haiku  | ~$0.25         | ~$1.25          |
| Claude Sonnet | ~$3.00         | ~$15.00         |

Free tier at 50K input + 25K output daily on Haiku ≈ $0.04/day ≈ $1.25/month per user.
Premium tier at 2M input + 1M output monthly on Sonnet ≈ $21/month per user (healthy margin on £49).

## Testing Notes

- Test daily aggregation: multiple recordings in same day merge correctly
- Test cap boundaries: exactly at limit, one over limit
- Test reset: usage from yesterday doesn't count toward today
- Test BYOM bypass: BYOM users never get 429
- Test warning threshold: 80% triggers warning flag
- Mock the date/time in tests for deterministic behaviour
- Coverage threshold: 90%
