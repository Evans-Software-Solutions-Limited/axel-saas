# Tier Alignment — Requirements

## User Stories

### US-T1: Consistent pricing across the product
**As a** prospective user  
**I want** the pricing I see on the marketing page to match what I see inside the app  
**So that** I trust the product and understand what I'm paying for

**Acceptance Criteria:**
- [ ] Public pricing page shows Free / Premium (£49) / Enterprise
- [ ] In-app discovery panel shows the same 3 tiers with matching prices
- [ ] Settings billing section shows the user's actual tier and correct price
- [ ] No reference to Starter/Pro/Business/Developer anywhere in the UI

### US-T2: Free tier agent provisioning
**As a** free tier user  
**I want** to get a provisioned agent after completing onboarding  
**So that** I can experience Axel before deciding to pay

**Acceptance Criteria:**
- [ ] Free users get an agent provisioned with `openclaw-free.json` config
- [ ] Free agent uses cheaper model defaults
- [ ] Free agent has daily usage caps (defined in token-management spec)
- [ ] Free users see a clear indicator of their remaining daily usage
- [ ] Free users can activate a 7-day Premium trial from the app

### US-T3: Premium checkout
**As a** user who wants full Axel capability  
**I want** to upgrade to Premium via a simple checkout  
**So that** I get unrestricted access

**Acceptance Criteria:**
- [ ] Single "Get started" or "Upgrade" button leads to Stripe checkout
- [ ] Only one Stripe Price ID used (`STRIPE_PRICE_PREMIUM`)
- [ ] After checkout, agent is re-provisioned with premium config
- [ ] User sees "Premium" tier in settings with correct renewal date

### US-T4: Enterprise contact flow
**As an** enterprise prospect  
**I want** to contact the team about custom pricing  
**So that** I can discuss SSO, SLAs, and volume needs

**Acceptance Criteria:**
- [ ] Enterprise card shows "Contact us" button
- [ ] Button opens mailto link to admin@evans-software-solutions.com
- [ ] No self-serve checkout for enterprise

### US-T5: Backend tier consistency
**As a** developer  
**I want** the database, API, and Stripe integration to use the same tier IDs  
**So that** there are no mapping bugs or state mismatches

**Acceptance Criteria:**
- [ ] `subscription_tier` enum is `free | premium | enterprise`
- [ ] Migration safely converts existing data
- [ ] All API responses use new tier IDs
- [ ] Stripe webhook correctly maps to `premium`
- [ ] Workspace templates exist for `free` and `premium` only
