import { eq } from "drizzle-orm";
import {
  type Db,
  type Subscription,
  subscriptions,
  subscriptionStatusEnum,
  subscriptionTierEnum,
  getDb,
} from "@axel-saas/db";

export type SubscriptionStatus =
  (typeof subscriptionStatusEnum.enumValues)[number];
export type SubscriptionTier = (typeof subscriptionTierEnum.enumValues)[number];

export class SubscriptionRepository {
  static readonly key = "SubscriptionRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async findByUserId(userId: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
    return row || null;
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<Subscription | null> {
    const [row] = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row || null;
  }

  async upsertByStripeCustomerId(input: {
    userId: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
    tier: SubscriptionTier;
    status: SubscriptionStatus;
    currentPeriodEnd?: Date;
  }): Promise<Subscription> {
    // Check if subscription exists
    const existing = await this.findByStripeCustomerId(input.stripeCustomerId);

    if (existing) {
      await this.db
        .update(subscriptions)
        .set({
          stripeSubscriptionId: input.stripeSubscriptionId,
          tier: input.tier,
          status: input.status,
          currentPeriodEnd: input.currentPeriodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));
      return { ...existing, ...input, updatedAt: new Date() };
    }

    const [row] = await this.db
      .insert(subscriptions)
      .values({
        userId: input.userId,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        tier: input.tier,
        status: input.status,
        currentPeriodEnd: input.currentPeriodEnd,
      })
      .returning();

    if (!row)
      throw new Error("Failed to create subscription — no row returned");
    return row;
  }

  async updateStatus(
    subscriptionId: string,
    status: SubscriptionStatus,
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));
  }

  async updateTier(
    subscriptionId: string,
    tier: SubscriptionTier,
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ tier, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));
  }

  async updatePeriodEnd(
    subscriptionId: string,
    currentPeriodEnd: Date,
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ currentPeriodEnd, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));
  }
}
