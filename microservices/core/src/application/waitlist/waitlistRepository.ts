import { eq } from "drizzle-orm";
import { type Db, type WaitlistEntry, getDb, waitlist } from "@axel-saas/db";
import { randomUUID } from "crypto";

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class WaitlistRepository {
  static readonly key = "WaitlistRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  /**
   * Create a new waitlist entry, or update the interestedIn tier for an
   * existing email. Email is normalised to lowercase on write.
   *
   * Returns the resulting record and whether it was newly created.
   */
  async upsertByEmail(
    email: string,
    interestedIn: WaitlistEntry["interestedIn"],
  ): Promise<{ record: WaitlistEntry; isNew: boolean }> {
    const normalizedEmail = email.toLowerCase();

    const [existing] = await this.db
      .select()
      .from(waitlist)
      .where(eq(waitlist.email, normalizedEmail))
      .limit(1);

    if (existing) {
      await this.db
        .update(waitlist)
        .set({ interestedIn, updatedAt: new Date() })
        .where(eq(waitlist.email, normalizedEmail));

      const [updated] = await this.db
        .select()
        .from(waitlist)
        .where(eq(waitlist.email, normalizedEmail))
        .limit(1);

      return { record: updated!, isNew: false };
    }

    const [created] = await this.db
      .insert(waitlist)
      .values({
        email: normalizedEmail,
        interestedIn,
        token: randomUUID(),
        confirmedAt: new Date(),
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create waitlist entry — no row returned");
    }

    return { record: created, isNew: true };
  }

  /**
   * Permanently delete a waitlist entry by its unsubscribe token.
   * Throws NotFoundError if the token does not exist.
   */
  async deleteByToken(token: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(waitlist)
      .where(eq(waitlist.token, token))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Waitlist entry not found for that token");
    }

    await this.db.delete(waitlist).where(eq(waitlist.token, token));
  }
}

export const waitlistRepository = new WaitlistRepository();
