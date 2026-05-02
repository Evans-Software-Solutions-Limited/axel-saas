import { eq } from "drizzle-orm";
import { type Db, type OauthState, oauthState, getDb } from "@axel-saas/db";

export class OauthStateRepository {
  static readonly key = "OauthStateRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async create(input: {
    userId: string;
    integrationId: string;
    stateToken: string;
    returnPath: string | null;
    expiresAt: Date;
  }): Promise<OauthState> {
    const [row] = await this.db
      .insert(oauthState)
      .values({
        userId: input.userId,
        integrationId: input.integrationId,
        stateToken: input.stateToken,
        returnPath: input.returnPath,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) throw new Error("Failed to create oauth state — no row returned");
    return row;
  }

  async findByToken(stateToken: string): Promise<OauthState | null> {
    const [row] = await this.db
      .select()
      .from(oauthState)
      .where(eq(oauthState.stateToken, stateToken))
      .limit(1);
    return row || null;
  }

  async deleteByToken(stateToken: string): Promise<void> {
    await this.db
      .delete(oauthState)
      .where(eq(oauthState.stateToken, stateToken));
  }
}
