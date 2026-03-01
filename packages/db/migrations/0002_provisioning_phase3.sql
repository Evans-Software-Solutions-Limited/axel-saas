-- Phase 3: config_generated status + provisioning_files table
-- Add new enum value for provisioning_status (order: after 'provisioning')
ALTER TYPE "provisioning_status" ADD VALUE IF NOT EXISTS 'config_generated' AFTER 'provisioning';

-- Create provisioning_files table
CREATE TABLE IF NOT EXISTS "provisioning_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"content" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "provisioning_files_user_id_file_name_idx" ON "provisioning_files" ("user_id", "file_name");

ALTER TABLE "provisioning_files" ADD CONSTRAINT "provisioning_files_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
