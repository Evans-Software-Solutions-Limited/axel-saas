-- Add waitlist table for soft-launch signup collection

CREATE TYPE "waitlist_interested_in" AS ENUM ('free', 'pro', 'enterprise');

CREATE TABLE IF NOT EXISTS "waitlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" text NOT NULL,
	"interested_in" "waitlist_interested_in" NOT NULL,
	"token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "waitlist_email_idx" ON "waitlist" ("email");
CREATE UNIQUE INDEX "waitlist_token_idx" ON "waitlist" ("token");
