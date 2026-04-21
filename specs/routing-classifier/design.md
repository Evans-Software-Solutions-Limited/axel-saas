# Routing Classifier Alignment — Design

## Overview

The routing classifier (`routingClassifier.ts` + `routingTypes.ts`) defines PII detection, data classification, and tier-based routing policies. It currently references the old 4-tier model (starter/pro/business/developer). It needs updating for the new 3-tier model (free/premium/enterprise).

## Current State

**PII Detection** — fully implemented, UK-centric regex patterns:

- Email addresses, phone numbers, postcodes, NI numbers, sort codes, bank accounts
- Financial data: currency amounts, financial phrases, IBANs

**Data Classification** — 4 levels: `clean`, `pii-suspected`, `financial-data`, `anonymized`

**Tier Policies** — currently defines routing rules per old tier:

- starter: no external calls, refuse PII, clean/anonymized only
- pro: external calls allowed, log PII, clean/pii/anonymized
- business/developer: external calls, anonymize PII, all data types

## New Tier Policy Mapping

| Old Tier  | New Tier              | Policy                                                             |
| --------- | --------------------- | ------------------------------------------------------------------ |
| starter   | **free**              | Conservative: no external calls, refuse PII, clean/anonymized only |
| pro       | **premium**           | Full: external calls, log PII, all data types with audit           |
| business  | **enterprise**        | Full+: anonymize PII, all data types, audit, custom rules          |
| developer | (merged into premium) | —                                                                  |

### Free Tier Policy

```typescript
{
  tier: "free",
  allowExternalCalls: false,
  piiHandling: "refuse",
  allowedDataClassifications: ["clean", "anonymized"],
  cloudFallback: false,
  auditLog: false
}
```

Free tier agents:

- Cannot make external API calls (no email sending, no webhook firing)
- Refuse to process messages containing detected PII
- Only handle clean or pre-anonymized data
- No cloud model fallback
- No audit logging (cost optimisation)

### Premium Tier Policy

```typescript
{
  tier: "premium",
  allowExternalCalls: true,
  piiHandling: "log-and-forward",
  allowedDataClassifications: ["clean", "pii-suspected", "financial-data", "anonymized"],
  cloudFallback: true,
  auditLog: true
}
```

Premium tier agents:

- Full external call access
- PII logged for audit but forwarded to the model
- All data classifications accepted
- Cloud model fallback available
- Audit logging enabled

### Enterprise Tier Policy

```typescript
{
  tier: "enterprise",
  allowExternalCalls: true,
  piiHandling: "anonymize",
  allowedDataClassifications: ["clean", "pii-suspected", "financial-data", "anonymized"],
  cloudFallback: true,
  auditLog: true
}
```

Enterprise tier agents:

- Same as premium but PII is anonymized before model processing
- Custom routing rules can be added per-organisation (post-MVP)

## Changes Required

### routingTypes.ts

- Update `SubscriptionTier` type: `"free" | "premium" | "enterprise"`
- Update `ROUTING_POLICIES` map with 3 entries instead of 4
- Keep `DataClassification`, `RoutingCategory`, `TaskEnvelope` unchanged

### routingClassifier.ts

- Update `getRoutingPolicy(tier)` to accept new tier values
- Update `buildTaskEnvelope()` if it references old tiers
- PII detection regex — no changes needed (UK patterns are tier-independent)
- `classifyData()` — no changes needed
- `resolveRoutingCategory()` — update policy lookup

### Integration with Chat Handler

The routing classifier is currently defined but not actively used in the chat handler. The `buildTaskEnvelope()` function creates a routing envelope, but the chat handler doesn't call it before proxying to the gateway.

**MVP approach:** Integrate the classifier into the chat handler so that:

1. Message is classified before sending to gateway
2. Free tier: messages with PII are rejected with a user-friendly message
3. Premium/Enterprise: classification result included in task event metadata for audit

This is a thin integration — the classifier is pure functions, no new infrastructure needed.

## No Schema Changes

This is a code-only change. No database migrations, no new tables, no new endpoints.
