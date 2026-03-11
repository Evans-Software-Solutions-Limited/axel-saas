-- Rename FK constraints from Drizzle default (*_users_id_fk) to *_fkey for consistency with 0000_initial.
-- Only onboarding_messages and onboarding_state had *_users_id_fk (created in 0002); the other three already use *_fkey from 0000.
ALTER TABLE "onboarding_messages" DROP CONSTRAINT "onboarding_messages_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "onboarding_state" DROP CONSTRAINT "onboarding_state_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "onboarding_messages" ADD CONSTRAINT "onboarding_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
