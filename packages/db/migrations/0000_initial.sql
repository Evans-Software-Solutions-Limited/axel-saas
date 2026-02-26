-- Initial migration for Axel SaaS
-- This creates the basic schema for users, subscriptions, provisioning state, and onboarding answers

-- Create subscription_tier enum
CREATE TYPE "subscription_tier" AS ENUM ('starter', 'pro', 'business', 'developer');

-- Create subscription_status enum
CREATE TYPE "subscription_status" AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'incomplete');

-- Create provisioning_status enum
CREATE TYPE "provisioning_status" AS ENUM ('pending', 'provisioning', 'active', 'failed', 'deprovisioned');

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"supabase_user_id" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique indexes for users
CREATE UNIQUE INDEX "users_supabase_user_id_idx" ON "users" ("supabase_user_id");
CREATE UNIQUE INDEX "users_email_idx" ON "users" ("email");

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"tier" "subscription_tier" NOT NULL,
	"status" "subscription_status" DEFAULT 'incomplete' NOT NULL,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique indexes for subscriptions
CREATE UNIQUE INDEX "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions" ("stripe_customer_id");

-- Create provisioning_state table
CREATE TABLE IF NOT EXISTS "provisioning_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"status" "provisioning_status" DEFAULT 'pending' NOT NULL,
	"ecs_task_arn" text,
	"workspace_path" text,
	"error_message" text,
	"provisioned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique index for provisioning_state
CREATE UNIQUE INDEX "provisioning_state_user_id_idx" ON "provisioning_state" ("user_id");

-- Create onboarding_answers table
CREATE TABLE IF NOT EXISTS "onboarding_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"answers" jsonb DEFAULT '{}' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create unique index for onboarding_answers
CREATE UNIQUE INDEX "onboarding_answers_user_id_idx" ON "onboarding_answers" ("user_id");

-- Add foreign key constraints
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "provisioning_state" ADD CONSTRAINT "provisioning_state_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;

ALTER TABLE "onboarding_answers" ADD CONSTRAINT "onboarding_answers_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;