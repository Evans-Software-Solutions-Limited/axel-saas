-- Per-user, per-day token usage aggregation.
--
-- Free tier has a daily token cap; Premium has a monthly cap. We aggregate
-- by (user_id, date, model, source) so an upsert can simply increment the
-- existing row instead of inserting a new row per chat message — a single
-- user could otherwise generate hundreds of rows per day.
--
-- `model` is recorded so future BYOM accounting and per-model cost
-- attribution work without a backfill. `source` distinguishes chat from
-- scheduled tasks / crons. Both default to text rather than enums so new
-- providers and surfaces can be added without a migration.
--
-- Estimated cost is intentionally nullable: in MVP we don't have real
-- per-token pricing yet. The backend can populate it later from a price
-- table without re-doing this migration.

CREATE TABLE IF NOT EXISTS "token_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"usage_date" date NOT NULL,
	"model" text NOT NULL DEFAULT 'unknown',
	"source" text NOT NULL DEFAULT 'chat',
	"input_tokens" integer NOT NULL DEFAULT 0,
	"output_tokens" integer NOT NULL DEFAULT 0,
	"estimated_cost_usd" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "token_usage_user_date_model_source_idx" ON "token_usage" ("user_id", "usage_date", "model", "source");
CREATE INDEX "token_usage_user_date_idx" ON "token_usage" ("user_id", "usage_date");

ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
