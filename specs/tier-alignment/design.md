# Tier Alignment — Design

## Problem

The codebase has three conflicting tier models:
1. **Public pricing page** (`publicPricing.ts`): Free / Premium (£49) / Enterprise
2. **In-app discovery panel** (`planRecommendation.ts`): Starter (£19) / Pro (£49) / Business (£99) / Developer (£149) / Enterprise
3. **Backend** (`subscriptionHandler.ts`): Starter / Pro / Business / Developer with 4 Stripe price IDs
4. **Settings page** (hardcoded): Shows "Professional" at £79/month

The public pricing page is the source of truth. Everything else must align.

## Target Tier Model

| Tier | ID | Price | Stripe | Self-serve |
|---|---|---|---|---|
| Free | `free` | £0 | No checkout needed | Yes |
| Premium | `premium` | £49/month | Single Stripe Price ID | Yes |
| Enterprise | `enterprise` | Contact us | Manual/invoice | No |

## Changes Required

### Database

**Schema change** — `subscription_tier` enum:
- Remove: `starter`, `pro`, `business`, `developer`
- Add: `free`, `premium`, `enterprise`
- Migration: map existing rows (`starter` → `free`, `pro`/`business`/`developer` → `premium`)

### Backend

**`subscriptionHandler.ts`**:
- Replace 4-tier TIERS array with 3-tier model
- Single `STRIPE_PRICE_PREMIUM` env var (replaces 4 price IDs)
- `GET /subscriptions/tiers` returns new tier list
- `POST /subscriptions/checkout` accepts only `premium` as tierId

**`stripeHandler.ts`**:
- Webhook maps Stripe subscription → `premium` tier
- Remove tier-from-metadata logic that expects 4 values

**Workspace templates**:
- Replace `openclaw-starter.json`, `openclaw-pro.json`, `openclaw-business.json`, `openclaw-developer.json` with `openclaw-free.json` and `openclaw-premium.json`
- Free: cheaper model defaults (e.g. `anthropic/haiku`), usage caps
- Premium: stronger model defaults (e.g. `anthropic/sonnet`), higher limits

**`docker-entrypoint.sh`**:
- Update tier placeholder injection to handle `free` / `premium`

### Frontend

**`planRecommendation.ts`**:
- Replace 5-plan PLANS array with: Free / Premium / Enterprise
- Simplify keyword matching — recommendation is binary (free vs premium)
- Enterprise has `tierId: null` (contact us)

**`DiscoveryPanel.tsx`**:
- 3-card layout instead of 5
- Free: "Get started" → provisions free agent
- Premium: "Get started" → Stripe checkout
- Enterprise: "Contact us" → mailto link

**`publicPricing.ts`** — already correct, no changes needed

**`subscribeApi.ts`**:
- `createCheckoutSession` sends `tier: "premium"` (only option)

**`Settings.tsx`**:
- Replace hardcoded "Professional £79/month" with real data from `/subscriptions/status`

**`ChatContainer.tsx`**:
- Discovery mode plan selection uses new 3-tier model

### Infrastructure

**SST secrets**:
- Replace `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_DEVELOPER` with single `STRIPE_PRICE_PREMIUM`

**`infra/api.ts`**:
- Update environment variable bindings

## Data Flow

```
User signs up (Supabase) → user created with no subscription
  → Free tier: agent provisioned with free config
  → User clicks "Get started" on Premium → Stripe checkout
  → Webhook → subscription created as `premium`
  → Agent re-provisioned with premium config
```
