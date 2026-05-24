-- Per-user OpenClaw Fargate sessions.
--
-- A row exists for every session the core API has started or attempted
-- to start. The row is the source of truth for AWS resources tied to
-- the session (the ECS task, the ALB target group + listener rule, the
-- EFS access point). When a session stops, `stopped_at` is set and
-- `stopped_reason` records why — the row is NOT deleted so we keep an
-- audit trail across all sessions for a user, useful for billing
-- attribution and reaper accounting.
--
-- `name` is the DNS-safe subdomain (validated in the application layer
-- against the spec §7.1 rules). The partial unique index enforces that
-- two active sessions cannot share a name — case-insensitive because
-- DNS is. Stopped sessions don't hold the name, so a name is released
-- as soon as its session stops; that's deliberate per spec §7.1's
-- idempotency contract ("re-submitting the same name for the same
-- owner returns the running session OR restarts it on the same name;
-- cross-user collision returns 409"). Cross-user collision is detected
-- by application code via lookup, not by the index — the index only
-- needs to guard the running window.
--
-- `efs_access_point_id` is denormalised onto the session row even
-- though it's per-user in nature: keeping it here lets a session row
-- be torn down independently without joining, and at session start
-- we look up any prior session for the user to reuse their existing
-- access point ID.

CREATE TYPE "openclaw_stopped_reason" AS ENUM (
  'user',
  'reaper',
  'error',
  'tier_change'
);

CREATE TABLE IF NOT EXISTS "openclaw_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	-- The tier the session started under. Pinned to the row (not
	-- looked up from the subscription at read time) so the
	-- idempotent reconnect path returns the correct expiresAt even
	-- if the user has been downgraded since the session started.
	-- The reaper (Phase 6) also reads this to apply the right
	-- wall-clock cap retroactively.
	"tier" "subscription_tier" NOT NULL,
	"task_arn" text NOT NULL,
	"target_group_arn" text NOT NULL,
	"listener_rule_arn" text NOT NULL,
	"efs_access_point_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stopped_at" timestamp with time zone,
	"stopped_reason" "openclaw_stopped_reason"
);

-- Partial unique index: only enforce uniqueness across ACTIVE sessions
-- (stopped_at IS NULL). This is what enforces spec §7.1's cross-user
-- 409 conflict semantics — and it lets a stopped session's name be
-- reclaimed by anyone (including its original owner) without a row
-- delete.
CREATE UNIQUE INDEX "openclaw_sessions_active_name_idx"
	ON "openclaw_sessions" (lower("name"))
	WHERE "stopped_at" IS NULL;

CREATE INDEX "openclaw_sessions_user_id_idx" ON "openclaw_sessions" ("user_id");
CREATE INDEX "openclaw_sessions_user_active_idx"
	ON "openclaw_sessions" ("user_id")
	WHERE "stopped_at" IS NULL;

ALTER TABLE "openclaw_sessions" ADD CONSTRAINT "openclaw_sessions_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
