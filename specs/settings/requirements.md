# Settings & Billing — Requirements

## User Stories

### US-S1: View and edit my profile

**As a** user  
**I want** to see and update my name  
**So that** Axel addresses me correctly

**Acceptance Criteria:**

- [ ] Name field pre-populated from API
- [ ] Name is editable with "Save changes" button
- [ ] Email shown but read-only (managed by Supabase)
- [ ] Save triggers `PUT /users/me` and shows success feedback
- [ ] Optimistic update with rollback on error

### US-S2: View my subscription status

**As a** user  
**I want** to see my current plan, status, and renewal date  
**So that** I understand my billing situation

**Acceptance Criteria:**

- [ ] Shows current tier name (Free / Premium)
- [ ] Shows status badge (Active / Cancelled / Past Due)
- [ ] Premium shows renewal date
- [ ] Free shows upgrade CTA
- [ ] No hardcoded values — all from API

### US-S3: Upgrade to Premium

**As a** Free tier user  
**I want** to upgrade to Premium  
**So that** I get full Axel capability

**Acceptance Criteria:**

- [ ] "Upgrade to Premium" button visible on Free tier
- [ ] Clicking redirects to Stripe checkout (same flow as discovery panel)
- [ ] After checkout, settings page shows Premium tier
- [ ] Not visible to users already on Premium

### US-S4: Manage payment method

**As a** Premium user  
**I want** to update my payment card  
**So that** my subscription doesn't lapse

**Acceptance Criteria:**

- [ ] "Manage payment" button opens Stripe Customer Portal
- [ ] User can update card, view billing history in Stripe-hosted UI
- [ ] Return URL brings user back to settings page

### US-S5: View invoice history

**As a** Premium user  
**I want** to see my past invoices  
**So that** I can track my spending

**Acceptance Criteria:**

- [ ] Invoice list shows: date, amount, description, status (paid/unpaid)
- [ ] Uses existing `GET /stripe/invoices` endpoint
- [ ] Most recent invoices shown (latest 5-10)
- [ ] Empty state for users with no invoices (Free tier)

### US-S6: Cancel subscription

**As a** Premium user  
**I want** to cancel my subscription  
**So that** I'm not charged next month

**Acceptance Criteria:**

- [ ] "Cancel plan" button with confirmation dialog
- [ ] Confirmation shows: what you'll lose, when access ends
- [ ] Cancellation sets subscription to cancel at period end (not immediate)
- [ ] After cancelling, shows "Cancelled — active until [date]"
- [ ] User can continue using Premium until period end

### US-S7: Notification preferences

**As a** user  
**I want** to control what notifications I receive  
**So that** I'm not overwhelmed by emails

**Acceptance Criteria:**

- [ ] Email notifications toggle (on/off)
- [ ] Toggle state persisted to backend
- [ ] Toggle state loaded on page mount

### US-S8: Delete account

**As a** user  
**I want** to permanently delete my account and data  
**So that** my information is removed

**Acceptance Criteria:**

- [ ] "Delete account" button in danger zone with double-confirmation
- [ ] First confirm: "Are you sure? This cannot be undone."
- [ ] Second confirm: type account email to verify
- [ ] Deletion cancels subscription, deletes all user data (cascade)
- [ ] Redirects to home page after deletion
