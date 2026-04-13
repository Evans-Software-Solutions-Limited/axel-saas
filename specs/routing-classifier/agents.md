# Routing Classifier Alignment — Agent Instructions

## Context

The routing classifier detects PII and applies tier-based data handling policies. It currently uses the old 4-tier model (starter/pro/business/developer). Update it for the new 3-tier model (free/premium/enterprise) and integrate it into the chat handler.

## Key Files to Modify

| File                                                              | What to change                                    |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `microservices/core/src/application/routing/routingTypes.ts`      | Update SubscriptionTier type and ROUTING_POLICIES |
| `microservices/core/src/application/routing/routingClassifier.ts` | Update policy lookup functions                    |
| `microservices/core/src/application/chat/chatHandler.ts`          | Add classification before gateway proxy           |

## This is a Small Change

The classifier is pure functions with no DB/network dependencies. The core work is:

1. Change 3 type definitions
2. Replace 4 policy objects with 3
3. Add 5-10 lines to the chat handler for classification gating

Don't over-engineer this. The PII regex and classification logic don't change at all.

## Chat Handler Integration Pattern

```typescript
// In chatHandler POST /users/chat/message, before gateway proxy:
const classification = classifyData(body.message);
const policy = getRoutingPolicy(subscription.tier);

if (!policy.allowedDataClassifications.includes(classification)) {
  return (
    (ctx.set.status = 422),
    {
      error: "data_classification_blocked",
      message:
        "Your message contains what looks like personal information. On the Free plan, Axel can't process this directly. Try rephrasing without specific details, or upgrade to Premium for full capability.",
      classification, // label only, not the detected values
    }
  );
}

// After gateway response, attach to task event:
await taskRepo.appendEvent({
  taskId,
  eventType: "task.completed",
  source: "chat",
  payload: {
    dataClassification: classification,
    // ... other metadata
  },
});
```

## Rules

1. **Never echo PII back to the user** in error messages. Say "personal information" not "we detected your NI number XX-XXXX-XX".
2. **Classification labels only in logs/events.** The values `clean`, `pii-suspected`, `financial-data` — never the actual detected data.
3. **Free tier refusal must be friendly.** Not "BLOCKED" — explain why and offer upgrade path.
4. **Don't change PII regex.** The detection patterns are tier-independent and already tested.
5. **Pure functions stay pure.** The classifier must remain free of DB/network calls.

## Testing Notes

- Existing classifier tests in `__tests__/` — update tier references, verify all pass
- Add integration test: chatHandler + classifier (mock gateway, verify free+PII→422)
- Coverage threshold: 90%
