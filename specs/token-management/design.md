# Token Management & Cost Control — Design

## Overview

Axel is OpenClaw-as-a-Service. OpenClaw uses a pay-per-token model with AI providers. We absorb this cost and offer flat-rate subscriptions (Free at £0, Premium at £49/month). This means we need tight control over token usage to protect unit economics.

This spec covers:
1. How we track token usage per user
2. How we enforce daily caps on Free tier
3. How we route to cost-appropriate models per tier
4. How we handle BYOM (Bring Your Own Model) for Premium users
5. What the user sees in the UI

## Architecture

```
User sends message (chat or scheduled task)
  → OpenClaw processes with configured model
    → OpenClaw reports token usage via gateway API / logs
      → Backend records usage in token_usage table
        → Backend checks against daily/monthly caps
          → If over cap: return 429 with clear message
          → If approaching cap: return warning in response metadata
```

## Model Routing Strategy

Aligned with existing `docs/model-routing-and-cost-policy.md`:

| Tier | Primary Model | Background/Prep | Trust-Critical |
|---|---|---|---|
| **Free** | Cheap lane (Haiku / free hosted) | Same | Same (limited daily budget) |
| **Premium** | Stronger (Sonnet) | Cheap lane (Haiku) | Premium lane (Sonnet/Opus) |
| **BYOM** | User's model | User's model | User's model |

### Free Tier Cost Budget

**Goal:** Free tier is genuinely useful but cheap to serve.

Daily token budget (platform-funded):
- **Input tokens:** ~50,000/day (~25 substantial interactions)
- **Output tokens:** ~25,000/day
- **Rough cost:** ~$0.02-0.05/day per free user using Haiku

This allows a free user to:
- Get a daily brief
- Have 10-20 short conversations
- Run 2-3 light automations

When the daily budget is exhausted:
- User sees "Daily limit reached — resets at midnight UTC"
- Agent stops responding to new requests
- Scheduled tasks are deferred to next day
- Upgrade CTA shown

### Premium Tier Cost Budget

Monthly token budget (funded by £49 subscription):
- **Input tokens:** ~2,000,000/month
- **Output tokens:** ~1,000,000/month
- **Rough cost:** ~$15-25/month using Sonnet mix (healthy margin on £49)

Soft limits:
- Warning at 80% monthly usage
- Hard cap at 100% (with option to purchase add-on — post-MVP)

### BYOM (Bring Your Own Model)

When a user provides their own API key:
- All token costs go to their account (we don't pay)
- No usage caps from our side
- We still track usage for visibility
- User's key injected into OpenClaw config

## Database Schema

```sql
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,                    -- Usage date (for daily aggregation)
  model TEXT NOT NULL,                   -- "anthropic/haiku", "openai/gpt-4o", etc.
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6),     -- Estimated cost at current rates
  source TEXT,                           -- "chat", "cron", "task"
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date, model, source)  -- Aggregate per user/day/model/source
);

CREATE INDEX idx_token_usage_user_date ON token_usage(user_id, date);

CREATE TABLE usage_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL UNIQUE,             -- "free", "premium"
  daily_input_tokens INTEGER,
  daily_output_tokens INTEGER,
  monthly_input_tokens INTEGER,
  monthly_output_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO usage_caps (tier, daily_input_tokens, daily_output_tokens, monthly_input_tokens, monthly_output_tokens) VALUES
  ('free', 50000, 25000, NULL, NULL),
  ('premium', NULL, NULL, 2000000, 1000000);
```

## API Endpoints

```
GET /users/me/usage
  → Returns current usage + limits
  {
    tier: "free" | "premium",
    byom: boolean,
    daily: {
      inputTokens: 12500,
      outputTokens: 6200,
      limits: { inputTokens: 50000, outputTokens: 25000 } | null
    },
    monthly: {
      inputTokens: 450000,
      outputTokens: 210000,
      limits: { inputTokens: 2000000, outputTokens: 1000000 } | null
    },
    estimatedCostUsd: 3.45,
    percentUsed: 42,
    warningThreshold: 80
  }

GET /users/me/usage/history?days=30
  → Returns daily usage breakdown for charting
  {
    days: [
      { date: "2026-04-13", inputTokens: 12500, outputTokens: 6200, costUsd: 0.03 },
      ...
    ]
  }
```

## Usage Enforcement

### Where to enforce

Token caps are enforced at the **chat handler** and **task execution** layer:

1. Before processing a message: check `GET current usage vs cap`
2. If over cap: return 429 with message
3. If approaching cap (>80%): include warning in response metadata
4. After processing: record usage

### How usage is recorded

OpenClaw reports token usage via its `/status` and `/usage` endpoints. Our backend polls or receives this data and records it.

**MVP approach:** After each chat message response, the gateway reports tokens used. Backend records in `token_usage`.

## Frontend UI

### Usage Indicator (Dashboard Header or Settings)

```
┌─────────────────────────────────────┐
│  Usage today: 42% of daily limit    │
│  ████████████░░░░░░░░░░░░░░░░ 42%  │
│  Resets at midnight UTC             │
└─────────────────────────────────────┘
```

For Free tier: show in sidebar or dashboard header as a subtle indicator.
For Premium tier: show in Settings → Billing section.

### Rate Limit Message (Chat)

When daily/monthly cap is hit:
```
┌─────────────────────────────────────┐
│  You've reached your daily limit.   │
│  It resets at midnight UTC.         │
│                                     │
│  Want more? Upgrade to Premium      │
│  for 40x the capacity.             │
│  [Upgrade to Premium →]            │
└─────────────────────────────────────┘
```

### Usage in Settings

In the Settings → Billing section, show:
- Current month's usage (tokens + estimated cost for BYOM)
- Daily usage chart (last 7/30 days)
- Current limits based on tier

## OpenClaw Config

### Free tier (`openclaw-free.json`)

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/haiku"
      }
    }
  }
}
```

### Premium tier (`openclaw-premium.json`)

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "anthropic/sonnet",
        "secondary": "anthropic/haiku"
      }
    }
  }
}
```

### BYOM override

When user provides their own key, the config is updated:
```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "openai/gpt-4o"
      }
    }
  }
}
```

With the user's API key in the environment.
