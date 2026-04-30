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
   * Concurrency-safe: a naive find-then-insert can race when two calls land
   * for the same user (double-clicked signup, retried network call). The
   * insert uses ON CONFLICT (user_id) DO NOTHING so the loser of the race
   * gets back an empty result and re-reads the winner's row instead of
   * crashing on the unique index.
   *
   * This is the entry point for self-serve free-tier signup. A later premium
   * upgrade reuses the same row via upsertByStripeCustomerId's userId
   * fallback above.
   */
  async createFreeSubscription(userId: string): Promise<Subscription> {
    const existing = await this.findByUserId(userId);
    if (existing) return existing;

    const inserted = await this.db
      .insert(subscriptions)
      .values({
        userId,
        tier: "free",
        status: "active",
      })
      .onConflictDoNothing({ target: subscriptions.userId })
      .returning();

    if (inserted[0]) return inserted[0];

    // Lost the race — another concurrent call inserted first. Re-read.
    const winner = await this.findByUserId(userId);
    if (!winner)
      throw new Error("Failed to create free subscription — no row returned");
    return winner;
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

  async updateCancelAtPeriodEnd(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean,
  ): Promise<void> {
    await this.db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));
  }
}
