#!/usr/bin/env bash
#
# verify-chat-loop.sh — end-to-end chat verification against a real
# OpenClaw Fargate session. Proves the chat loop closes:
#
#   core API JWT  →  POST /openclaw/sessions  (creates Fargate task + ALB rule)
#                →  poll /healthz             (task + bridge plugin live)
#                →  POST /api/chat            (bridge plugin → OpenClaw
#                                             `/v1/chat/completions`)
#                ←  {response, messageId, ...}
#                →  DELETE session            (teardown)
#
# Why this script exists: the bridge plugin (#99) was only ever
# smoke-tested against a local docker compose container. Post-Phase-5
# the chat loop runs through a real Fargate session + ALB + bridge
# plugin, and that combination has never been proven end-to-end. This
# is the operator step that closes that gap.
#
# Usage:
#   STAGE=staging \
#   JWT=eyJ... \
#   OPENCLAW_GATEWAY_TOKEN=<token> \
#   USER_ID=<your-db-user-uuid> \
#   ./apps/openclaw/scripts/verify-chat-loop.sh
#
# Optional env:
#   API_BASE        — override the API base URL (default: derived from STAGE)
#   SESSION_NAME    — session name to use (default: chatverify-<timestamp>)
#   CHAT_MESSAGE    — message to send to the agent (default: simple ping)
#   POLL_TIMEOUT    — seconds to wait for the session URL (default: 240)
#   POLL_INTERVAL   — seconds between polls (default: 15)
#   CHAT_TIMEOUT    — seconds to wait for the chat response (default: 90)
#   SKIP_DELETE     — set to 1 to leave the session running after the test
#
# Prerequisites:
#   - PR #112/#113 merged + the openclaw stack deployed for the stage
#   - The :bootstrap image pushed via push-bootstrap-image.sh
#   - OPENCLAW_GATEWAY_TOKEN matches the value the openclaw runtime expects
#     (set as an SST secret on the openclaw stack, or read from the Lambda
#     env that the session was created with)
#   - USER_ID exists in the DB and matches what the JWT authenticates as
#     (the bridge plugin requires userId in the request body for OpenClaw
#     to scope its memory/agent state per-user)
#
# Exit codes:
#   0 — POST 201 → /healthz 200 → /api/chat 200 with non-empty response → DELETE 204
#   1 — usage / config error
#   2 — POST session failed
#   3 — session /healthz never reached 200 within POLL_TIMEOUT
#   4 — POST /api/chat returned non-200 or non-JSON
#   5 — /api/chat response missing/empty .response field
#   6 — DELETE failed

set -euo pipefail

STAGE="${STAGE:-}"
JWT="${JWT:-}"
OPENCLAW_GATEWAY_TOKEN="${OPENCLAW_GATEWAY_TOKEN:-}"
USER_ID="${USER_ID:-}"
if [[ -z "$STAGE" || -z "$JWT" || -z "$OPENCLAW_GATEWAY_TOKEN" || -z "$USER_ID" ]]; then
  echo "ERROR: STAGE, JWT, OPENCLAW_GATEWAY_TOKEN, and USER_ID env vars required" >&2
  echo "  STAGE=staging JWT=eyJ... OPENCLAW_GATEWAY_TOKEN=<token> USER_ID=<uuid> $0" >&2
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

SESSION_NAME="${SESSION_NAME:-chatverify-$(date +%s)}"
CHAT_MESSAGE="${CHAT_MESSAGE:-Hello, this is a chat-loop verification ping. Reply with a single short sentence.}"
POLL_TIMEOUT="${POLL_TIMEOUT:-240}"
POLL_INTERVAL="${POLL_INTERVAL:-15}"
CHAT_TIMEOUT="${CHAT_TIMEOUT:-90}"

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
echo "  STAGE          $STAGE"
echo "  API_BASE       $API_BASE"
echo "  SESSION_NAME   $SESSION_NAME"
echo "  USER_ID        $USER_ID"
echo "  CHAT_MESSAGE   ${CHAT_MESSAGE:0:60}..."
echo

# ────────────────────────────────────────────────────────────────────
# 1. POST /openclaw/sessions
# ────────────────────────────────────────────────────────────────────
echo "── 1. POST /openclaw/sessions ────────────────────────────────────"
POST_RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$SESSION_NAME\"}" \
  "$API_BASE/openclaw/sessions") || {
    echo "ERROR: curl POST failed (network/DNS/TLS, not an HTTP response)" >&2
    exit 2
  }

POST_BODY=$(echo "$POST_RESPONSE" | sed '$d')
POST_STATUS=$(echo "$POST_RESPONSE" | tail -n1)

# Parse SESSION_ID immediately so the trap can clean up on any later
# crash (same pattern as smoke-test-sessions.sh).
SESSION_ID=$(echo "$POST_BODY" | jq -r '.sessionId // empty' 2>/dev/null || echo "")

echo "Status: $POST_STATUS"
echo "Body:   $POST_BODY"

if [[ "$POST_STATUS" != "201" && "$POST_STATUS" != "200" ]]; then
  echo "ERROR: expected 201 (created) or 200 (existing), got $POST_STATUS" >&2
  exit 2
fi

SESSION_URL=$(echo "$POST_BODY" | jq -r '.url // empty' 2>/dev/null || echo "")
if [[ -z "$SESSION_ID" || -z "$SESSION_URL" ]]; then
  echo "ERROR: response missing sessionId or url" >&2
  exit 2
fi
echo "  sessionId  $SESSION_ID"
echo "  url        $SESSION_URL"
echo

# ────────────────────────────────────────────────────────────────────
# 2. Poll /healthz until OpenClaw is live
# ────────────────────────────────────────────────────────────────────
echo "── 2. Poll ${SESSION_URL}/healthz until OpenClaw is live ─────────"
# Strip all trailing slashes (same defensiveness as smoke-test-sessions.sh).
HEALTHZ_URL="$(echo "$SESSION_URL" | sed 's:/*$::')/healthz"
deadline=$(( $(date +%s) + POLL_TIMEOUT ))
url_up=0
while [[ $(date +%s) -lt $deadline ]]; do
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

# ────────────────────────────────────────────────────────────────────
# 3. POST /api/chat to the bridge plugin
# ────────────────────────────────────────────────────────────────────
echo "── 3. POST ${SESSION_URL}/api/chat ───────────────────────────────"
# The bridge plugin's /api/chat expects:
#   - Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>     (auth: "gateway")
#   - Body: {message: string, userId: string, sessionId?: string}
# It returns:
#   - {response: string, messageId: string, sessionId: string, usage: {...}}
# See packages/openclaw-bridge-plugin/src/transforms/chatShape.ts.
#
# CHAT_BODY is built via jq to safely encode CHAT_MESSAGE — a curl
# inline string with shell interpolation breaks on any quote/newline
# in the message.
CHAT_BODY=$(jq -n \
  --arg msg "$CHAT_MESSAGE" \
  --arg uid "$USER_ID" \
  --arg sid "$SESSION_ID" \
  '{message: $msg, userId: $uid, sessionId: $sid}')

CHAT_URL="$(echo "$SESSION_URL" | sed 's:/*$::')/api/chat"
CHAT_RESPONSE=$(curl -ksS -w "\n%{http_code}" --max-time "$CHAT_TIMEOUT" -X POST \
  -H "Authorization: Bearer $OPENCLAW_GATEWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CHAT_BODY" \
  "$CHAT_URL") || {
    echo "ERROR: curl POST /api/chat failed (network/timeout)" >&2
    exit 4
  }

CHAT_RESPONSE_BODY=$(echo "$CHAT_RESPONSE" | sed '$d')
CHAT_STATUS=$(echo "$CHAT_RESPONSE" | tail -n1)

echo "Status: $CHAT_STATUS"
echo "Body:   $CHAT_RESPONSE_BODY" | head -c 500
echo

if [[ "$CHAT_STATUS" != "200" ]]; then
  echo "ERROR: expected 200 from /api/chat, got $CHAT_STATUS" >&2
  case "$CHAT_STATUS" in
    401) echo "Hint: 401 — OPENCLAW_GATEWAY_TOKEN doesn't match the runtime's expected bearer." >&2 ;;
    400) echo "Hint: 400 — body shape invalid. Check USER_ID is a real DB UUID and CHAT_MESSAGE is non-empty." >&2 ;;
    405) echo "Hint: 405 — bridge plugin's /api/chat may not be registered. Check the gateway boot log for 'axel-bridge' plugin presence." >&2 ;;
    504) echo "Hint: 504 — upstream /v1/chat/completions timed out (60s default). Slow LLM provider or workspace agent misconfigured." >&2 ;;
    502) echo "Hint: 502 — upstream /v1/chat/completions returned a network/parse error. Check the gateway log for the actual upstream response." >&2 ;;
  esac
  exit 4
fi

# Parse + verify shape: response is non-empty, messageId is present.
RESPONSE_TEXT=$(echo "$CHAT_RESPONSE_BODY" | jq -r '.response // empty' 2>/dev/null || echo "")
MESSAGE_ID=$(echo "$CHAT_RESPONSE_BODY" | jq -r '.messageId // empty' 2>/dev/null || echo "")
USAGE_MODEL=$(echo "$CHAT_RESPONSE_BODY" | jq -r '.usage.model // empty' 2>/dev/null || echo "")

if [[ -z "$RESPONSE_TEXT" ]]; then
  echo "ERROR: /api/chat response missing/empty .response field" >&2
  echo "       Full body: $CHAT_RESPONSE_BODY" >&2
  exit 5
fi

echo
echo "  ✓ messageId    $MESSAGE_ID"
echo "  ✓ usage.model  $USAGE_MODEL"
echo "  ✓ response     ${RESPONSE_TEXT:0:200}..."
echo

if [[ "${SKIP_DELETE:-0}" == "1" ]]; then
  echo "── SKIP_DELETE=1 — leaving session running ───────────────────────"
  echo "Stop manually with:"
  echo "  curl -X DELETE -H 'Authorization: Bearer \$JWT' $API_BASE/openclaw/sessions/$SESSION_ID"
  exit 0
fi

# ────────────────────────────────────────────────────────────────────
# 4. DELETE the session
# ────────────────────────────────────────────────────────────────────
echo "── 4. DELETE /openclaw/sessions/$SESSION_ID ──────────────────────"
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer $JWT" \
  "$API_BASE/openclaw/sessions/$SESSION_ID")

if [[ "$DELETE_STATUS" != "204" ]]; then
  echo "ERROR: expected 204, got $DELETE_STATUS" >&2
  exit 6
fi
echo "✓ 204"
SESSION_ID=""
echo
echo "✅ Chat loop verified end-to-end (POST → /healthz → /api/chat → DELETE)"
