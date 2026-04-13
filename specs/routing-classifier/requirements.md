# Routing Classifier Alignment — Requirements

## User Stories

### US-RC1: Tier-aligned routing policies
**As the** platform  
**I want** routing policies to match the new 3-tier model  
**So that** data handling rules are correct for Free, Premium, and Enterprise

**Acceptance Criteria:**
- [ ] `SubscriptionTier` type is `"free" | "premium" | "enterprise"`
- [ ] Routing policies defined for all 3 tiers
- [ ] No references to starter/pro/business/developer in routing code
- [ ] Free tier: conservative (no external calls, refuse PII)
- [ ] Premium tier: full access with audit logging
- [ ] Enterprise tier: full access with PII anonymization

### US-RC2: Free tier PII protection
**As a** Free tier user  
**I want** to be told if my message contains sensitive data that can't be processed  
**So that** I understand the limitation and can rephrase

**Acceptance Criteria:**
- [ ] Messages classified before forwarding to gateway
- [ ] Free tier: PII-containing messages rejected with friendly message
- [ ] Message explains what was detected (without echoing the PII back) and suggests rephrasing
- [ ] Premium/Enterprise: PII messages processed normally (with logging)

### US-RC3: Audit trail for data classification
**As the** platform  
**I want** data classification results stored with task events  
**So that** we have an audit trail for compliance

**Acceptance Criteria:**
- [ ] Classification result (`clean`, `pii-suspected`, `financial-data`) attached to task event metadata
- [ ] Audit logging enabled for Premium and Enterprise only
- [ ] No PII values stored in the audit log — only the classification result
- [ ] Free tier: no audit logging (cost optimisation)

### US-RC4: PII detection accuracy
**As a** user  
**I want** PII detection to be accurate and not over-flag  
**So that** legitimate messages aren't blocked unnecessarily

**Acceptance Criteria:**
- [ ] Existing UK-centric PII patterns maintained (email, phone, postcode, NI, sort code, bank account)
- [ ] Financial data detection maintained (currency, IBAN, financial phrases)
- [ ] No false positives on common words or numbers
- [ ] Classification is deterministic (same input → same result)
