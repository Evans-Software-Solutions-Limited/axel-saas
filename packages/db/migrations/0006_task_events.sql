-- Add tasks and task_events tables for internal task lifecycle tracking.
-- task_events is append-only (no updated_at) — state is projected from the log.

CREATE TABLE IF NOT EXISTS "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"task_summary" text,
	"repo" text,
	"branch" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "tasks_user_id_idx" ON "tasks" ("user_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;

-- event_type is plain text — new event types do not require a DB migration.
CREATE TABLE IF NOT EXISTS "task_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"task_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"source" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "task_events_task_id_idx" ON "task_events" ("task_id");

ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey"
	FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE cascade;
