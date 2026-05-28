#!/usr/bin/env bash
#
# smoke-test-sessions.sh — end-to-end smoke test for the openclaw
# sessions API (POST + GET + DELETE) against a deployed stage. Exercises
# the same code path Stripe webhooks and the chat handler eventually
# will, with full teardown so it can be run repeatedly.
#
# Usage:
#   STAGE=staging JWT=eyJ... ./apps/openclaw/scripts/smoke-test-sessions.sh
#
# Optional env:
#   API_BASE        — override the API base URL (default: derived from STAGE)
#   SESSION_NAME    — session name to use (default: smoke-<timestamp>)
#   POLL_TIMEOUT    — seconds to wait for the URL to respond (default: 180)
#   POLL_INTERVAL   — seconds between polls (default: 10)
#   SKIP_DELETE     — set to 1 to leave the session running after the test
#
# Prerequisites:
#   - PR #112 merged + the next pipeline run completed (SSM params populated)
#   - Bootstrap image pushed via push-bootstrap-image.sh
#   - A valid Supabase JWT for a user that exists in the DB
#     (the openclaw handler resolves the DB user from the JWT's `sub`)
#
# Exit codes:
#   0 — golden path: POST 201 → URL returns non-error → DELETE 204
#   1 — usage / config error
#   2 — POST failed
#   3 — URL never came up within POLL_TIMEOUT
#   4 — GET didn't list the session
#   5 — DELETE failed

set -euo pipefail

STAGE="${STAGE:-}"
JWT="${JWT:-}"
if [[ -z "$STAGE" || -z "$JWT" ]]; then
  echo "ERROR: STAGE and JWT env vars required" >&2
  echo "  STAGE=staging JWT=eyJ... $0" >&2
  exit 1
fi

case "$STAGE" in
  staging)    DEFAULT_API="https://api.staging.meetaxel.ai" ;;
  production) DEFAULT_API="https://api.meetaxel.ai" ;;
  *)          DEFAULT_API="" ;;
esac

API_BASE="${API_BASE:-$DEFAULT_API}"
if [[ -z "$API_BASE" ]]; then
  echo "ERROR: API_BASE required for non-staging/production STAGE=$STAGE" >&2
  exit 1
fi

# Session names: lowercase alphanumeric + hyphens, 3-63 chars (matches
# the route's t.String validator and nameValidation.ts rules).
SESSION_NAME="${SESSION_NAME:-smoke-$(date +%s)}"
POLL_TIMEOUT="${POLL_TIMEOUT:-180}"
POLL_INTERVAL="${POLL_INTERVAL:-10}"

# Track the session ID across steps so the trap can clean up on error.
SESSION_ID=""

cleanup() {
  local exit_code=$?
  if [[ "${SKIP_DELETE:-0}" == "1" ]]; then
    return
  fi
  if [[ -n "$SESSION_ID" && "$exit_code" -ne 0 ]]; then
    echo
    echo "── Cleanup (error path) ──────────────────────────────────────────"
    curl -fsS -X DELETE \
      -H "Authorization: Bearer $JWT" \
      "$API_BASE/openclaw/sessions/$SESSION_ID" \
      >/dev/null 2>&1 \
      && echo "Cleaned up session $SESSION_ID" \
      || echo "WARN: cleanup DELETE failed for $SESSION_ID — clean up manually"
  fi
}
trap cleanup EXIT

echo "── Config ────────────────────────────────────────────────────────"
echo "  STAGE        $STAGE"
echo "  API_BASE     $API_BASE"
echo "  SESSION_NAME $SESSION_NAME"
echo

echo "── 1. POST /openclaw/sessions ────────────────────────────────────"
# Deliberately NOT using `curl -f`: -f hides the response body on 4xx/5xx,
# which would silence every interesting branch the API actually returns
# (400 invalid_name, 409 name_conflict, 429 rate-limited, 429
# concurrency_cap, 503 dns_unavailable, 500 internal). We parse the
# status code from -w ourselves and surface the body verbatim.
POST_RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$SESSION_NAME\"}" \
  "$API_BASE/openclaw/sessions") || {
    echo "ERROR: curl POST failed (network/DNS/TLS error, not an HTTP response)" >&2
    exit 2
  }

POST_BODY=$(echo "$POST_RESPONSE" | sed '$d')
POST_STATUS=$(echo "$POST_RESPONSE" | tail -n1)

# Assign SESSION_ID BEFORE any other parsing or echoing — if any
# subsequent step crashes under `set -e`, the trap needs SESSION_ID
# set so it can clean up. On non-2xx responses jq returns empty,
# which is correct (no resource to clean up).
SESSION_ID=$(echo "$POST_BODY" | jq -r '.sessionId // empty' 2>/dev/null || echo "")

echo "Status: $POST_STATUS"
echo "Body:   $POST_BODY"

if [[ "$POST_STATUS" != "201" && "$POST_STATUS" != "200" ]]; then
  echo "ERROR: expected 201 (created) or 200 (existing), got $POST_STATUS" >&2
  echo "       See body above for the API's error detail." >&2
  case "$POST_STATUS" in
    429) echo "Hint: 429 may be a rate-limit (write category) or concurrency_cap." >&2 ;;
    503) echo "Hint: 503 dns_unavailable usually means the openclaw SST app hasn't been deployed for stage=$STAGE yet, or SSM params are missing." >&2 ;;
    400) echo "Hint: 400 invalid_name — check SESSION_NAME ('$SESSION_NAME') against nameValidation.ts." >&2 ;;
    409) echo "Hint: 409 name_conflict — a session with this name already exists for this user." >&2 ;;
  esac
  exit 2
fi

# Same `|| echo ""` guard as SESSION_ID — keep all body parses uniformly
# resilient to malformed JSON so the script can fall through to the
# explicit "missing sessionId or url" check below rather than crashing
# out of the pipeline with a confusing pipefail error.
SESSION_URL=$(echo "$POST_BODY" | jq -r '.url // empty' 2>/dev/null || echo "")
EXPIRES_AT=$(echo "$POST_BODY" | jq -r '.expiresAt // empty' 2>/dev/null || echo "")

if [[ -z "$SESSION_ID" || -z "$SESSION_URL" ]]; then
  echo "ERROR: response missing sessionId or url" >&2
  exit 2
fi

echo "  sessionId  $SESSION_ID"
echo "  url        $SESSION_URL"
echo "  expiresAt  $EXPIRES_AT"
echo

echo "── 2. Poll ${SESSION_URL}/healthz until OpenClaw is live ─────────"
# The Fargate task takes ~30-60s to come up + clear ALB health checks.
# We deliberately probe `/healthz` and require an exact 200, because:
#
#   - The ALB's *default* listener action returns 404 ("Not Found") for
#     any subdomain not matched by a listener rule (alb.ts L52-59). The
#     per-session listener rule that `createSession` adds takes a moment
#     to propagate, so probing the bare `/` and accepting "anything not
#     5xx" would treat the ALB-default 404 as success — a false positive.
#   - OpenClaw's `/healthz` returns `{"ok":true,"status":"live"}` with
#     a 200 once the gateway is up (per docs/handoff/next-session-brief.md
#     §"OpenClaw upstream..."). 200 from `/healthz` therefore unambiguously
#     means: listener rule is in place AND the task is responsive.
#
# Each iteration: 10s curl timeout + POLL_INTERVAL sleep. With defaults
# (POLL_TIMEOUT=180, POLL_INTERVAL=10) that's ~9 attempts.
# Strip *all* trailing slashes (not just one) so a hypothetical
# `https://…/` or even `…//` from the service still produces a clean
# `…/healthz`. `${VAR%/}` only strips one; sed handles any number.
HEALTHZ_URL="$(echo "$SESSION_URL" | sed 's:/*$::')/healthz"
deadline=$(( $(date +%s) + POLL_TIMEOUT ))
url_up=0
while [[ $(date +%s) -lt $deadline ]]; do
  # -o /dev/null: discard body. -w %{http_code}: emit code. -k: tolerate
  # certs (shouldn't matter on staging, but cheap to be lenient on a
  # subdomain that's brand new). --max-time 10: 5s was too tight for a
  # first DNS lookup + TLS handshake on a never-seen subdomain.
  code=$(curl -ks -o /dev/null -w "%{http_code}" --max-time 10 "$HEALTHZ_URL" || echo "000")
  if [[ "$code" == "200" ]]; then
    echo "  $(date +%T) — 200 ✓ (healthz live)"
    url_up=1
    break
  fi
  echo "  $(date +%T) — $code (warming up; retrying in ${POLL_INTERVAL}s)"
  sleep "$POLL_INTERVAL"
done

if [[ "$url_up" -ne 1 ]]; then
  echo "ERROR: ${HEALTHZ_URL} did not return 200 within ${POLL_TIMEOUT}s" >&2
  echo "       Last status: $code. Trap will DELETE the session." >&2
  exit 3
fi
echo

echo "── 3. GET /openclaw/sessions ─────────────────────────────────────"
GET_BODY=$(curl -fsS -H "Authorization: Bearer $JWT" "$API_BASE/openclaw/sessions")
echo "$GET_BODY" | jq '.'

# Confirm our session appears in the list.
found=$(echo "$GET_BODY" | jq --arg id "$SESSION_ID" '.sessions[] | select(.sessionId == $id) | .sessionId')
if [[ -z "$found" ]]; then
  echo "ERROR: session $SESSION_ID not present in GET response" >&2
  exit 4
fi
echo "✓ session present in list"
echo

if [[ "${SKIP_DELETE:-0}" == "1" ]]; then
  echo "── SKIP_DELETE=1 — leaving session running ───────────────────────"
  echo "Stop manually with:"
  echo "  curl -X DELETE -H 'Authorization: Bearer \$JWT' $API_BASE/openclaw/sessions/$SESSION_ID"
  exit 0
fi

echo "── 4. DELETE /openclaw/sessions/$SESSION_ID ──────────────────────"
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer $JWT" \
  "$API_BASE/openclaw/sessions/$SESSION_ID")

if [[ "$DELETE_STATUS" != "204" ]]; then
  echo "ERROR: expected 204, got $DELETE_STATUS" >&2
  exit 5
fi
echo "✓ 204"
# Prevent the trap from running its cleanup branch — we already deleted.
SESSION_ID=""
echo
echo "✅ Smoke test passed (POST → URL up → GET → DELETE)"
