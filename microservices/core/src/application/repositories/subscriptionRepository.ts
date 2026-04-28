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
    // Try to match an existing row by stripeCustomerId first (the common
    // re-entrant webhook path). If no row matches, fall back to userId so a
    // pre-existing free row (created via createFreeSubscription before any
    // Stripe interaction) is upgraded in place — the unique index on userId
    // would otherwise reject a fresh insert.
    const existing =
      (await this.findByStripeCustomerId(input.stripeCustomerId)) ??
      (await this.findByUserId(input.userId));

    if (existing) {
      await this.db
        .update(subscriptions)
        .set({
          stripeCustomerId: input.stripeCustomerId,
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

  /**
   * Idempotent free-tier provisioning. If the user already has any
   * subscription row (free, premium, enterprise — any status), the existing
   * row is returned unchanged. Otherwise a new row is inserted with
   * tier=free, status=active, and no Stripe IDs.
   *
   * This is the entry point for self-serve free-tier signup. A later premium
   * upgrade reuses the same row via upsertByStripeCustomerId's userId
   * fallback above.
   */
  async createFreeSubscription(userId: string): Promise<Subscription> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const [row] = await this.db
      .insert(subscriptions)
      .values({
        userId,
        tier: "free",
        status: "active",
      })
      .returning();

    if (!row)
      throw new Error("Failed to create free subscription — no row returned");
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
