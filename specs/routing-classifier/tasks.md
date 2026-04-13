# Routing Classifier Alignment — Tasks

## Type Updates

- [ ] Update `SubscriptionTier` in `routingTypes.ts`: `"free" | "premium" | "enterprise"`
- [ ] Update `ROUTING_POLICIES` map: replace 4 entries with 3 (free, premium, enterprise)
- [ ] Update any type exports that reference old tier names

## Policy Updates

- [ ] Define Free policy: no external calls, refuse PII, clean/anonymized only, no audit
- [ ] Define Premium policy: external calls, log PII, all classifications, audit enabled
- [ ] Define Enterprise policy: external calls, anonymize PII, all classifications, audit enabled

## Classifier Updates

- [ ] Update `getRoutingPolicy(tier)` to accept `"free" | "premium" | "enterprise"`
- [ ] Update `resolveRoutingCategory()` if it references old tier-specific logic
- [ ] Update `buildTaskEnvelope()` for new tier values
- [ ] Verify PII detection regex still work (no changes expected)
- [ ] Verify `classifyData()` still works (no changes expected)

## Chat Handler Integration

- [ ] Call `classifyData(message)` in `chatHandler.ts` before proxying to gateway
- [ ] Free tier + PII detected → return 422 with friendly message ("Your message contains what looks like personal information. On the Free plan, Axel can't process this. You can rephrase or upgrade to Premium.")
- [ ] Premium/Enterprise → proceed normally
- [ ] Attach classification result to task event metadata (for audit trail)
- [ ] Only log classification labels, never the detected PII values

## Tests

- [ ] Update existing routing classifier tests for new tier names
- [ ] Test Free policy: PII refused, clean allowed
- [ ] Test Premium policy: PII logged and forwarded
- [ ] Test Enterprise policy: PII flagged for anonymization
- [ ] Test chat handler integration: Free + PII → 422, Free + clean → 200
- [ ] Test audit metadata attached to task events
- [ ] Verify PII detection regression tests still pass
- [ ] Verify no false positives on common inputs

## Quality Gates

- [ ] `bun run prettier:check`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] `bun run test:unit`
