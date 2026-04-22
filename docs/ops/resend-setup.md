# Resend Setup — Production & Staging

Step-by-step runbook for wiring up transactional email for Axel. Assumes zero prior Resend / DNS experience.

**Time estimate:** 30–45 min end-to-end, most of which is waiting for DNS to propagate.

## What you're setting up

- A Resend account (email provider)
- Two verified domains: `meetaxel.ai` (production) and `staging.meetaxel.ai` (staging)
- DNS records in Route 53 that prove to inbox providers that we're allowed to send from those domains (SPF, DKIM, DMARC)
- Two API keys stored as SST secrets (one per stage)
- An environment variable telling the backend which "from" address to use

Once this is done, every email the code sends (waitlist confirmations, subscription receipts, usage warnings, etc.) actually arrives in users' inboxes instead of being silently skipped.

## What you need before starting

- [ ] Admin access to the Resend dashboard (after sign-up you'll have it automatically)
- [ ] Access to the AWS account that owns the `meetaxel.ai` hosted zone (Route 53)
- [ ] Access to the AWS account / SST stage for **staging** (to set secrets) — zone `Z0445995RJ5V60U79DR5`
- [ ] Access to the AWS account / SST stage for **production** — zone `Z00975242RQYVLZ1LRN73`
- [ ] A personal inbox you can receive test emails at (Gmail is fine)

If you're not sure whether you have AWS access, open the AWS Console and go to **Route 53 → Hosted zones**. If you see `meetaxel.ai` and `staging.meetaxel.ai` listed, you're good.

---

## Part 1 — Create the Resend account

1. Go to <https://resend.com> and click **Sign up**.
2. Use the Evans Software Solutions email (so the account isn't tied to a personal address).
3. On the welcome screen, when asked for region, **pick EU (Dublin)** — UK users prefer EU-hosted data for GDPR reasons.
4. Verify your email, log in.

You now have an account on Resend's free plan: **100 emails/day, 3,000/month**. That's plenty for early users.

---

## Part 2 — Add the production domain

1. In the Resend dashboard, click **Domains** in the left sidebar.
2. Click **Add Domain** in the top right.
3. Enter `meetaxel.ai` (no `https://`, no trailing slash).
4. Pick region **EU (Dublin)** if asked.
5. Click **Add**.

Resend now shows a page with a **table of DNS records** you need to add. Keep this tab open — you'll copy values from it in the next part.

The records look something like this (yours will have different exact values):

| Type | Host / Name         | Value                                   | Priority |
| ---- | ------------------- | --------------------------------------- | -------- |
| MX   | `send`              | `feedback-smtp.eu-west-1.amazonses.com` | 10       |
| TXT  | `send`              | `v=spf1 include:amazonses.com ~all`     |          |
| TXT  | `resend._domainkey` | (long DKIM public key)                  |          |
| TXT  | `_dmarc`            | `v=DMARC1; p=none;`                     |          |

Don't close this tab.

---

## Part 3 — Add the records to Route 53 (production)

This is the part that's easy to get wrong. Follow exactly.

### Step 1: Open the production hosted zone

1. AWS Console → search "Route 53" → **Hosted zones**.
2. Find the row where **Domain name = `meetaxel.ai`** (the one _without_ `staging` in it).
3. Confirm the **Hosted Zone ID** matches `Z00975242RQYVLZ1LRN73`. If it doesn't, you're in the wrong AWS account — stop and check which account you're in.
4. Click the domain name to open the zone.

### Step 2: Add each record one at a time

For each row in the table Resend shows you:

1. Click **Create record** (orange button, top right).
2. **Routing policy:** Simple routing. Click **Next**.
3. **Define simple record:**
   - **Record name:** Only the subdomain part. Resend might show `send.meetaxel.ai` — you only type `send`. Route 53 auto-appends `.meetaxel.ai`.
     - Record named `send` → type `send`
     - Record named `resend._domainkey` → type `resend._domainkey`
     - Record named `_dmarc` → type `_dmarc`
     - **⚠️ If Resend shows the bare domain (`meetaxel.ai`) as the name, leave the Route 53 name field BLANK.** Don't type the domain.
   - **Record type:** Match exactly what Resend shows (`TXT`, `CNAME`, `MX`).
   - **Value / Route traffic to:** Click the dropdown, pick **"IP address or another value depending on the record type"**, then paste the value from Resend exactly as shown. Include any surrounding quotes Resend provides.
   - **TTL:** Set to `300` seconds (5 minutes). This makes fixes faster if you mis-paste something.
4. Click **Define simple record** to add it to the batch.
5. Repeat for the next row.
6. When all rows are added, click **Create records** at the bottom.

### Step 3: ⚠️ Check for conflicts before you start

Before adding records, scroll through the existing records in the zone and look for:

- An existing `TXT` record on the bare domain starting with `v=spf1 ...` — the domain already has an SPF. You **cannot have two SPF records** on the same name; you have to merge them. If you see this, **stop and message me** — I'll help you combine them safely. Do NOT just add a second one.
- An existing `TXT` record on `_dmarc` — the domain already has a DMARC policy. Don't overwrite without understanding what the existing one does.

If there's nothing existing for `send`, `resend._domainkey`, or `_dmarc`, you're clear to add.

### Step 4: Wait for Resend to verify

1. Back on the Resend tab, click **Verify DNS records** (or wait — it polls automatically).
2. Status moves from **Pending** → **Verified** usually within 5 minutes, sometimes up to an hour.
3. When all rows show green ticks, production domain is done.

If after an hour it's still pending, see the Troubleshooting section at the bottom.

---

## Part 4 — Add the staging domain

Same process as production, but for the `staging.meetaxel.ai` subdomain.

1. Back in the Resend dashboard → **Domains** → **Add Domain**.
2. Enter `staging.meetaxel.ai` (note: this is the full subdomain, not just `staging`).
3. Region: EU (Dublin).
4. Resend shows a new table of records.

5. In AWS Route 53, open the **`staging.meetaxel.ai`** hosted zone (zone ID `Z0445995RJ5V60U79DR5`) — **a different zone** from the production one.
6. Same drill: create each record, using only the subdomain portion as the name (Route 53 auto-appends `.staging.meetaxel.ai`).

Records go in the staging zone, not the production one. If you add them to the production zone by mistake, Resend will never verify.

Wait for verification.

---

## Part 5 — Create the API keys

One key per stage so you can revoke independently.

### Production key

1. Resend dashboard → **API Keys** → **Create API Key**.
2. Name: `Axel Production`
3. Permission: **Full access**
4. Domain: restrict to `meetaxel.ai`
5. Click **Add** — a string starting with `re_` appears. **Copy it immediately.** You can never see it again; if you lose it you create a new one.

### Staging key

Same steps, but:

- Name: `Axel Staging`
- Domain: restrict to `staging.meetaxel.ai`

Keep both keys in a password manager temporarily — you'll paste them into SST secrets next.

---

## Part 6 — Set the SST secrets

Open a terminal in the repo root.

```bash
# Production
bunx sst secret set AxelSaasResendApiKey re_YOUR_PRODUCTION_KEY --stage production

# Staging
bunx sst secret set AxelSaasResendApiKey re_YOUR_STAGING_KEY --stage staging
```

SST encrypts these and makes them available to the Lambda at runtime as `process.env.RESEND_API_KEY`. They're **per-stage**, so production code never sees the staging key and vice versa.

You can verify they're set with:

```bash
bunx sst secret list --stage production
bunx sst secret list --stage staging
```

You'll see `AxelSaasResendApiKey` listed but the value will be masked — that's correct.

---

## Part 7 — Set the from-address per stage

The code reads `EMAIL_FROM_ADDRESS` from the environment and falls back to `"Axel <hello@meetaxel.ai>"` if it's not set.

**For production:** the default is fine. No action needed unless you want to override the display name.

**For staging:** set it so users can tell staging emails apart from production:

In the GitHub Actions workflow that deploys staging (or wherever your staging deploy is configured), add:

```
EMAIL_FROM_ADDRESS="Axel (Staging) <hello@staging.meetaxel.ai>"
```

If you don't have a GitHub Actions deploy for staging yet, you can set it when you run `sst deploy` locally:

```bash
EMAIL_FROM_ADDRESS="Axel (Staging) <hello@staging.meetaxel.ai>" bunx sst deploy --stage staging
```

---

## Part 8 — Verify end-to-end

Once the staging deploy picks up the new secret:

1. Open the staging site and join the waitlist with your real email.
2. Within 30 seconds, you should get a "waitlist-joined" email from `hello@staging.meetaxel.ai`.
3. Check the Resend dashboard → **Logs** tab. You should see the send logged with status "delivered".

If the email arrives, you're done. Repeat the same test on production when you're ready.

---

## Troubleshooting

### Domain stuck on "Pending" for more than an hour

Check whether the records actually exist from outside AWS. Run in a terminal:

```bash
# Replace the subdomain values with what Resend asked for
dig TXT send.meetaxel.ai
dig TXT resend._domainkey.meetaxel.ai
dig TXT _dmarc.meetaxel.ai
```

If these return `;; ANSWER SECTION:` with the right values, records are live and Resend just hasn't re-checked yet — click **Verify DNS records** in Resend to nudge it.

If they return nothing, the records aren't in DNS:

- Double-check in Route 53 that you typed the name correctly (`send`, not `send.meetaxel.ai`)
- Check you saved the records (the blue "Create records" button at the bottom, not just "Define simple record")
- Check you're in the right hosted zone (production vs staging)

### Email lands in spam

- Wait a few days of sending — new domains have no reputation and often start in spam
- Make sure the from-address matches the verified domain (`@meetaxel.ai` not `@gmail.com`)
- The default DMARC we set is `p=none` which is permissive; tightening later requires care

### "Domain not verified" error when the code tries to send

- Check the Resend dashboard shows the domain as Verified
- Check the SST secret is set for the right stage: `bunx sst secret list --stage <stage>`
- Check the Lambda was redeployed after the secret was set — secrets are only picked up on deploy

### Accidentally added records to the wrong zone

Harmless — just delete them from the wrong zone and re-add in the right one. Route 53 records can be safely deleted and re-created without breaking anything else.

---

## Checklist for tomorrow

Print or copy this to tick off as you go:

- [ ] Resend account created (EU region)
- [ ] Production domain `meetaxel.ai` added in Resend
- [ ] Production Route 53 records created (zone `Z00975242RQYVLZ1LRN73`)
- [ ] Production domain shows "Verified" in Resend
- [ ] Staging domain `staging.meetaxel.ai` added in Resend
- [ ] Staging Route 53 records created (zone `Z0445995RJ5V60U79DR5`)
- [ ] Staging domain shows "Verified" in Resend
- [ ] Production API key created (`Axel Production`, restricted to `meetaxel.ai`)
- [ ] Staging API key created (`Axel Staging`, restricted to `staging.meetaxel.ai`)
- [ ] `AxelSaasResendApiKey` SST secret set for production stage
- [ ] `AxelSaasResendApiKey` SST secret set for staging stage
- [ ] `EMAIL_FROM_ADDRESS` set for staging deploy (optional for prod)
- [ ] Staging deployed with new secret picked up
- [ ] Joined staging waitlist with real email — received confirmation
- [ ] Resend Logs tab shows the delivery

If any step blocks you, message me with:

1. Which step
2. What you see vs what the runbook says you should see
3. A screenshot if it's a UI thing

We'll fix it in real time.
