import { eq, and } from "drizzle-orm";
import {
  type Db,
  type User,
  type NewUser,
  type Subscription,
  type ProvisioningState,
  type ProvisioningFiles,
  getDb,
  users,
  subscriptions,
  provisioningState,
  onboardingAnswers,
  provisioningFiles,
} from "@axel-saas/db";

export type UserWithRelations = User & {
  subscription?: Subscription;
  provisioningState?: ProvisioningState;
};

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

  async storeProvisioningFile(
    userId: string,
    fileName: string,
    content: string,
  ): Promise<ProvisioningFiles> {
    const existing = await this.db
      .select()
      .from(provisioningFiles)
      .where(
        and(
          eq(provisioningFiles.userId, userId),
          eq(provisioningFiles.fileName, fileName),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      await this.db
        .update(provisioningFiles)
        .set({ content, updatedAt: new Date() })
        .where(
          and(
            eq(provisioningFiles.userId, userId),
            eq(provisioningFiles.fileName, fileName),
          ),
        );
      const [updated] = await this.db
        .select()
        .from(provisioningFiles)
        .where(
          and(
            eq(provisioningFiles.userId, userId),
            eq(provisioningFiles.fileName, fileName),
          ),
        )
        .limit(1);
      if (!updated) throw new Error("Failed to update provisioning file");
      return updated;
    } else {
      const [created] = await this.db
        .insert(provisioningFiles)
        .values({
          userId,
          fileName,
          content,
        })
        .returning();
      if (!created) throw new Error("Failed to create provisioning file");
      return created;
    }
  }

  async getProvisioningFiles(userId: string): Promise<ProvisioningFiles[]> {
    return this.db
      .select()
      .from(provisioningFiles)
      .where(eq(provisioningFiles.userId, userId));
  }
}

export const userRepository = new UserRepository();
