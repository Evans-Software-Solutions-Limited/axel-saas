-- Add user_integrations table for storing integration metadata.
-- Secrets are stored in AWS Secrets Manager, NOT in this table.
-- Only safe metadata (status, keyHint, timestamps) lives here.

DO $$ BEGIN
  CREATE TYPE "integration_status" AS ENUM ('connected', 'error', 'revoked', 'pending');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"integration_id" text NOT NULL,
	"status" "integration_status" DEFAULT 'pending' NOT NULL,
	"key_hint" text,
	"label" text,
	"secret_path" text NOT NULL,
	"connected_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message_safe" text,
	"account_metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "user_integrations_user_id_idx" ON "user_integrations" ("user_id");
CREATE UNIQUE INDEX "user_integrations_user_integration_idx" ON "user_integrations" ("user_id", "integration_id");

ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
