# Email & Notifications — Requirements

## User Stories

### US-E1: Waitlist confirmation email

**As a** user who joins the waitlist  
**I want** to receive a confirmation email  
**So that** I know my signup was received

**Acceptance Criteria:**

- [ ] Email sent immediately after waitlist signup
- [ ] Contains: confirmation message, tier preference, unsubscribe link
- [ ] Sent from hello@meetaxel.ai (or configured from address)
- [ ] Replaces current `console.info` stub

### US-E2: Welcome email

**As a** new user who just signed up  
**I want** to receive a welcome email  
**So that** I know my account is ready and what to do next

**Acceptance Criteria:**

- [ ] Email sent after email verification / first sign-in
- [ ] Contains: greeting with name, link to dashboard, what to expect
- [ ] Sent once per user (not on every sign-in)

### US-E3: Subscription confirmation email

**As a** user who just subscribed to Premium  
**I want** to receive a confirmation  
**So that** I have a record of my subscription

**Acceptance Criteria:**

- [ ] Email sent after Stripe checkout.session.completed webhook
- [ ] Contains: tier name, price, renewal date, what's unlocked
- [ ] Includes link to dashboard

### US-E4: Payment failed email

**As a** user whose payment failed  
**I want** to be notified  
**So that** I can update my payment method before losing access

**Acceptance Criteria:**

- [ ] Email sent after Stripe invoice.payment_failed webhook
- [ ] Contains: what happened, link to update payment (Stripe portal), when access expires
- [ ] Tone is helpful, not threatening

### US-E5: Subscription cancelled email

**As a** user who cancelled  
**I want** confirmation of my cancellation  
**So that** I know when my access ends

**Acceptance Criteria:**

- [ ] Email sent after subscription cancelled
- [ ] Contains: confirmation, when access ends, what happens to data
- [ ] Option to resubscribe

### US-E6: Usage warning email

**As a** user approaching my usage limit  
**I want** to be warned before I hit the cap  
**So that** I can pace my usage or upgrade

**Acceptance Criteria:**

- [ ] Email sent when usage hits 80% of cap
- [ ] Max 1 warning email per user per day (no spam)
- [ ] Free tier: mentions upgrade path
- [ ] Premium tier: mentions usage stats

### US-E7: Emails are deliverable and professional

**As a** user  
**I want** emails to arrive in my inbox (not spam)  
**So that** I don't miss important notifications

**Acceptance Criteria:**

- [ ] DNS records configured: SPF, DKIM, DMARC for meetaxel.ai
- [ ] Domain verified with email provider
- [ ] Clean, minimal template matching product aesthetic
- [ ] Unsubscribe link on non-transactional emails
- [ ] From address: hello@meetaxel.ai (or configured)

### US-E8: Email failures don't break features

**As the** platform  
**I want** email sending to be fire-and-forget  
**So that** a Resend outage doesn't break waitlist signup or Stripe webhooks

**Acceptance Criteria:**

- [ ] Email send failures are logged but don't throw
- [ ] Caller receives success even if email fails
- [ ] No retry logic for MVP (log and move on)
