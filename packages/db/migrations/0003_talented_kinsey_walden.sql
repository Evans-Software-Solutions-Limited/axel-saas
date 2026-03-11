ALTER TABLE "onboarding_answers" DROP CONSTRAINT "onboarding_answers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "onboarding_messages" DROP CONSTRAINT "onboarding_messages_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "onboarding_state" DROP CONSTRAINT "onboarding_state_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "provisioning_state" DROP CONSTRAINT "provisioning_state_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "onboarding_answers" ADD CONSTRAINT "onboarding_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_messages" ADD CONSTRAINT "onboarding_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_state" ADD CONSTRAINT "provisioning_state_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;