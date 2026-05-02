-- One-time CSRF state tokens for the integrations OAuth flow.
--
-- Issued by GET /integrations/:id/oauth/start and consumed by the
-- provider-driven GET /integrations/:id/oauth/callback. Bound to a single
-- userId + integrationId so the callback (which is unauthenticated by
-- necessity — providers redirect with no Authorization header) can
-- recover the user from the state row alone.
--
-- Short TTL (10 minutes) is enforced at the application layer via
-- expires_at. Rows are hard-deleted on consumption; the unique index on
-- state_token doubles as a replay guard.

CREATE TABLE IF NOT EXISTS "oauth_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"integration_id" text NOT NULL,
	"state_token" text NOT NULL,
	"return_path" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "oauth_state_state_token_idx" ON "oauth_state" ("state_token");
CREATE INDEX "oauth_state_user_id_idx" ON "oauth_state" ("user_id");

ALTER TABLE "oauth_state" ADD CONSTRAINT "oauth_state_user_id_fkey"
	FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
