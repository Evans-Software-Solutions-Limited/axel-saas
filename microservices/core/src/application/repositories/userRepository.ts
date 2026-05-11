import { eq } from "drizzle-orm";
import {
  type Db,
  type User,
  type NewUser,
  type Subscription,
  type ProvisioningState,
  type NotificationPreferences,
  getDb,
  users,
  subscriptions,
  provisioningState,
  onboardingAnswers,
} from "@axel-saas/db";

export type UserWithRelations = User & {
  subscription?: Subscription;
  provisioningState?: ProvisioningState;
};

/**
 * Canonical default for `notification_preferences` keys. Stored rows
 * default to `{}` so old users implicitly opt into transactional mail —
 * filling the keys on read keeps the API response shape stable for the
 * frontend regardless of whether the column has ever been written.
 */
export const NOTIFICATION_DEFAULTS: Required<NotificationPreferences> = {
  emailNotifications: true,
  weeklyDigest: true,
};

export function withNotificationDefaults(
  prefs: NotificationPreferences | null | undefined,
): Required<NotificationPreferences> {
  return { ...NOTIFICATION_DEFAULTS, ...(prefs ?? {}) };
}

function rowToUser(
  userRow: typeof users.$inferSelect,
  subRow?: typeof subscriptions.$inferSelect,
  provRow?: typeof provisioningState.$inferSelect,
): UserWithRelations {
  return {
    id: userRow.id,
    supabaseUserId: userRow.supabaseUserId,
    email: userRow.email,
    fullName: userRow.fullName,
    onboardingCompleted: userRow.onboardingCompleted,
    notificationPreferences: userRow.notificationPreferences,
    createdAt: userRow.createdAt,
    updatedAt: userRow.updatedAt,
    ...(subRow && { subscription: subRow }),
    ...(provRow && { provisioningState: provRow }),
  };
}

export class UserRepository {
  static readonly key = "UserRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async findBySupabaseId(
    supabaseUserId: string,
  ): Promise<UserWithRelations | null> {
    const [userRow] = await this.db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId))
      .limit(1);

    if (!userRow) return null;

    const [subRow] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userRow.id))
      .limit(1);

    const [provRow] = await this.db
      .select()
      .from(provisioningState)
      .where(eq(provisioningState.userId, userRow.id))
      .limit(1);

    return rowToUser(userRow, subRow, provRow);
  }

  async findById(id: string): Promise<UserWithRelations | null> {
    const [userRow] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!userRow) return null;

    const [subRow] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userRow.id))
      .limit(1);

    const [provRow] = await this.db
      .select()
      .from(provisioningState)
      .where(eq(provisioningState.userId, userRow.id))
      .limit(1);

    return rowToUser(userRow, subRow, provRow);
  }

  async create(input: NewUser): Promise<User> {
    const [row] = await this.db.insert(users).values(input).returning();
    if (!row) throw new Error("Failed to create user — no row returned");
    return row;
  }

  async updateById(
    id: string,
    updates: Partial<Omit<User, "id" | "createdAt">>,
  ): Promise<void> {
    await this.db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async getUserBySupabaseId(supabaseUserId: string): Promise<User | null> {
    const [userRow] = await this.db
      .select()
      .from(users)
      .where(eq(users.supabaseUserId, supabaseUserId))
      .limit(1);

    return userRow ?? null;
  }

  async updateUser(
    id: string,
    updates: Partial<Omit<User, "id" | "createdAt">>,
  ): Promise<void> {
    await this.updateById(id, updates);
  }

  /**
   * Update the user's profile name. Returns the row after the update so
   * the handler can echo the new value back without an extra select.
   * Returns `null` if no user matched (already-deleted row).
   */
  async updateProfile(
    id: string,
    updates: { fullName: string | null },
  ): Promise<User | null> {
    const [row] = await this.db
      .update(users)
      .set({ fullName: updates.fullName, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row ?? null;
  }

  /**
   * Replace the entire notification_preferences object. The handler is
   * expected to merge with `NOTIFICATION_DEFAULTS` before calling so a
   * partial PUT body still produces a complete row — keeping that policy
   * in the handler avoids surprising read-modify-write at the repo layer.
   */
  async updateNotificationPreferences(
    id: string,
    prefs: NotificationPreferences,
  ): Promise<NotificationPreferences | null> {
    const [row] = await this.db
      .update(users)
      .set({ notificationPreferences: prefs, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row?.notificationPreferences ?? null;
  }

  /**
   * Hard-delete a user row. All child tables have `ON DELETE CASCADE` on
   * their FK to `users.id` (subscriptions, provisioning_state,
   * onboarding_state, onboarding_messages, onboarding_answers, tasks,
   * task_events via tasks, user_integrations, oauth_state, token_usage),
   * so this single call removes every owned row in the application DB.
   * The Supabase auth row is removed separately by the caller via
   * `deleteAuthUser`. Returns true when a row was deleted.
   */
  async deleteById(id: string): Promise<boolean> {
    const result = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return result.length > 0;
  }

  async updateOnboardingAnswers(
    userId: string,
    answers: Record<string, unknown>,
  ): Promise<void> {
    const existing = await this.db
      .select()
      .from(onboardingAnswers)
      .where(eq(onboardingAnswers.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(onboardingAnswers)
        .set({ answers, updatedAt: new Date() })
        .where(eq(onboardingAnswers.userId, userId));
    } else {
      await this.db.insert(onboardingAnswers).values({
        userId,
        answers,
        completedAt: new Date(),
      });
    }
  }

  /**
   * Get onboarding answers for a user
   */
  async getOnboardingAnswers(
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const [row] = await this.db
      .select()
      .from(onboardingAnswers)
      .where(eq(onboardingAnswers.userId, userId))
      .limit(1);

    return row?.answers ?? null;
  }
}

export const userRepository = new UserRepository();
