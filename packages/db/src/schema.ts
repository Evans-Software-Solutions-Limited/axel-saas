import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "free",
  "premium",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "incomplete",
]);

export const provisioningStatusEnum = pgEnum("provisioning_status", [
  "pending",
  "provisioning",
  "active",
  "failed",
  "deprovisioned",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supabaseUserId: text("supabase_user_id").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    onboardingCompleted: boolean("onboarding_completed")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    supabaseUserIdIdx: uniqueIndex("users_supabase_user_id_idx").on(
      table.supabaseUserId,
    ),
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    tier: subscriptionTierEnum("tier").notNull(),
    status: subscriptionStatusEnum("status").notNull().default("incomplete"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    // Mirror of Stripe's cancel_at_period_end. True between a portal-driven
    // cancellation and the period actually ending; lets the UI render
    // "Cancellation scheduled" rather than "Renews [date]".
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("subscriptions_user_id_idx").on(table.userId),
    stripeCustomerIdIdx: uniqueIndex("subscriptions_stripe_customer_id_idx").on(
      table.stripeCustomerId,
    ),
    stripeSubscriptionIdIdx: uniqueIndex(
      "subscriptions_stripe_subscription_id_idx",
    ).on(table.stripeSubscriptionId),
    subscriptionsUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "subscriptions_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

// ─── Provisioning State ────────────────────────────────────────────────────────

export const provisioningState = pgTable(
  "provisioning_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    status: provisioningStatusEnum("status").notNull().default("pending"),
    ecsTaskArn: text("ecs_task_arn"),
    workspacePath: text("workspace_path"),
    gatewayUrl: text("gateway_url"),
    errorMessage: text("error_message"),
    provisionedAt: timestamp("provisioned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("provisioning_state_user_id_idx").on(table.userId),
    provisioningStateUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "provisioning_state_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type ProvisioningState = typeof provisioningState.$inferSelect;
export type NewProvisioningState = typeof provisioningState.$inferInsert;

// ─── Onboarding Answers ───────────────────────────────────────────────────────

export const onboardingAnswers = pgTable(
  "onboarding_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    answers: jsonb("answers")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("onboarding_answers_user_id_idx").on(table.userId),
    onboardingAnswersUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "onboarding_answers_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type OnboardingAnswers = typeof onboardingAnswers.$inferSelect;
export type NewOnboardingAnswers = typeof onboardingAnswers.$inferInsert;

// ─── Onboarding State ──────────────────────────────────────────────────────────

export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "not_started",
  "in_progress",
  "completed",
]);

export const onboardingMessages = pgTable(
  "onboarding_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(), // "user" or "assistant"
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("onboarding_messages_user_id_idx").on(table.userId),
    createdAtIdx: index("onboarding_messages_created_at_idx").on(
      table.createdAt,
    ),
    onboardingMessagesUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "onboarding_messages_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type OnboardingMessage = typeof onboardingMessages.$inferSelect;
export type NewOnboardingMessage = typeof onboardingMessages.$inferInsert;

export const onboardingState = pgTable(
  "onboarding_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    status: onboardingStatusEnum("status").notNull().default("not_started"),
    // Ordered questions the backend wants answered - stored as JSON array
    outstandingQuestions: jsonb("outstanding_questions")
      .$type<string[]>()
      .notNull()
      .default([]),
    // Collected answers keyed by question
    collectedAnswers: jsonb("collected_answers")
      .$type<Record<string, string>>()
      .notNull()
      .default({}),
    // Track which required fields are complete
    requiredFieldsCompleted: jsonb("required_fields_completed")
      .$type<Record<string, boolean>>()
      .notNull()
      .default({}),
    // Timestamp when onboarding was completed
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Last message timestamp for consistency
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: uniqueIndex("onboarding_state_user_id_idx").on(table.userId),
    onboardingStateUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "onboarding_state_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type OnboardingState = typeof onboardingState.$inferSelect;
export type NewOnboardingState = typeof onboardingState.$inferInsert;

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    source: text("source").notNull(),
    taskSummary: text("task_summary"),
    repo: text("repo"),
    branch: text("branch"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("tasks_user_id_idx").on(table.userId),
    tasksUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "tasks_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

// Task event types — append-only log of what happened to a task.
// Use text (not pgEnum) so new event types can be added without a DB migration.
export type TaskEventType =
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.review_ready"
  | "task.no_changes";

// Projected task state derived from the event log.
export type TaskState =
  | "running"
  | "completed"
  | "failed"
  | "review_ready"
  | "no_changes"
  | "unknown";

// task_events is append-only — no updatedAt column by design.
export const taskEvents = pgTable(
  "task_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull(),
    eventType: text("event_type").notNull().$type<TaskEventType>(),
    source: text("source").notNull(),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    taskIdIdx: index("task_events_task_id_idx").on(table.taskId),
    taskEventsFk: foreignKey({
      columns: [table.taskId],
      foreignColumns: [tasks.id],
      name: "task_events_task_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type TaskEvent = typeof taskEvents.$inferSelect;
export type NewTaskEvent = typeof taskEvents.$inferInsert;

// ─── User Integrations ───────────────────────────────────────────────────────

export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "error",
  "revoked",
  "pending",
]);

export const userIntegrations = pgTable(
  "user_integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    integrationId: text("integration_id").notNull(),
    status: integrationStatusEnum("status").notNull().default("pending"),
    keyHint: text("key_hint"),
    label: text("label"),
    secretPath: text("secret_path").notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    lastErrorCode: text("last_error_code"),
    lastErrorMessageSafe: text("last_error_message_safe"),
    accountMetadata: jsonb("account_metadata")
      .$type<Record<string, unknown>>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userIdIdx: index("user_integrations_user_id_idx").on(table.userId),
    userIntegrationIdx: uniqueIndex(
      "user_integrations_user_integration_idx",
    ).on(table.userId, table.integrationId),
    userIntegrationsUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_integrations_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type UserIntegration = typeof userIntegrations.$inferSelect;
export type NewUserIntegration = typeof userIntegrations.$inferInsert;

// ─── OAuth State ───────────────────────────────────────────────────────────────

// Short-lived CSRF state for the integrations OAuth flow. The callback is
// unauthenticated (providers redirect with no Authorization header), so the
// row's userId is what lets us complete a connection without trusting the
// query string. Hard-deleted on consumption; replay-blocked by the unique
// index on state_token.
export const oauthState = pgTable(
  "oauth_state",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    integrationId: text("integration_id").notNull(),
    stateToken: text("state_token").notNull(),
    returnPath: text("return_path"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    stateTokenIdx: uniqueIndex("oauth_state_state_token_idx").on(
      table.stateToken,
    ),
    userIdIdx: index("oauth_state_user_id_idx").on(table.userId),
    oauthStateUserFk: foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "oauth_state_user_id_fkey",
    }).onDelete("cascade"),
  }),
);

export type OauthState = typeof oauthState.$inferSelect;
export type NewOauthState = typeof oauthState.$inferInsert;

// ─── Waitlist ──────────────────────────────────────────────────────────────────

export const waitlistInterestedInEnum = pgEnum("waitlist_interested_in", [
  "free",
  "pro",
  "enterprise",
]);

export const waitlist = pgTable(
  "waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    interestedIn: waitlistInterestedInEnum("interested_in").notNull(),
    token: text("token").notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("waitlist_email_idx").on(table.email),
    tokenIdx: uniqueIndex("waitlist_token_idx").on(table.token),
  }),
);

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
