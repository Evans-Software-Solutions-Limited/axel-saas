import { eq, and } from "drizzle-orm";
import {
  type Db,
  type UserIntegration,
  type NewUserIntegration,
  userIntegrations,
  getDb,
} from "@axel-saas/db";

export type IntegrationStatus = "connected" | "error" | "revoked" | "pending";

/**
 * Safe metadata shape returned by list/get — never includes secret values.
 */
export type IntegrationMetadata = Pick<
  UserIntegration,
  | "id"
  | "userId"
  | "integrationId"
  | "status"
  | "keyHint"
  | "label"
  | "connectedAt"
  | "lastCheckedAt"
  | "lastUsedAt"
  | "lastErrorCode"
  | "lastErrorMessageSafe"
  | "accountMetadata"
  | "createdAt"
  | "updatedAt"
>;

/**
 * Projects a DB row to safe metadata — strips secretPath.
 */
function toMetadata(row: UserIntegration): IntegrationMetadata {
  return {
    id: row.id,
    userId: row.userId,
    integrationId: row.integrationId,
    status: row.status,
    keyHint: row.keyHint,
    label: row.label,
    connectedAt: row.connectedAt,
    lastCheckedAt: row.lastCheckedAt,
    lastUsedAt: row.lastUsedAt,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessageSafe: row.lastErrorMessageSafe,
    accountMetadata: row.accountMetadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class IntegrationRepository {
  static readonly key = "IntegrationRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async findByUserAndIntegration(
    userId: string,
    integrationId: string,
  ): Promise<UserIntegration | null> {
    const [row] = await this.db
      .select()
      .from(userIntegrations)
      .where(
        and(
          eq(userIntegrations.userId, userId),
          eq(userIntegrations.integrationId, integrationId),
        ),
      )
      .limit(1);
    return row || null;
  }

  async listByUserId(userId: string): Promise<IntegrationMetadata[]> {
    const rows = await this.db
      .select()
      .from(userIntegrations)
      .where(eq(userIntegrations.userId, userId));
    return rows.map(toMetadata);
  }

  async getMetadata(
    userId: string,
    integrationId: string,
  ): Promise<IntegrationMetadata | null> {
    const row = await this.findByUserAndIntegration(userId, integrationId);
    return row ? toMetadata(row) : null;
  }

  async upsert(input: NewUserIntegration): Promise<UserIntegration> {
    const existing = await this.findByUserAndIntegration(
      input.userId,
      input.integrationId,
    );

    if (existing) {
      await this.db
        .update(userIntegrations)
        .set({
          status: input.status,
          keyHint: input.keyHint,
          label: input.label,
          secretPath: input.secretPath,
          connectedAt: input.connectedAt,
          accountMetadata: input.accountMetadata,
          lastErrorCode: null,
          lastErrorMessageSafe: null,
          updatedAt: new Date(),
        })
        .where(eq(userIntegrations.id, existing.id));
      return {
        ...existing,
        status: input.status ?? existing.status,
        keyHint: input.keyHint ?? existing.keyHint,
        label: input.label !== undefined ? input.label : existing.label,
        secretPath: input.secretPath,
        connectedAt: input.connectedAt ?? existing.connectedAt,
        accountMetadata: input.accountMetadata ?? existing.accountMetadata,
        lastErrorCode: null,
        lastErrorMessageSafe: null,
        updatedAt: new Date(),
      };
    }

    const [row] = await this.db
      .insert(userIntegrations)
      .values(input)
      .returning();
    if (!row) throw new Error("Failed to create integration — no row returned");
    return row;
  }

  async updateStatus(
    id: string,
    status: IntegrationStatus,
    errorFields?: {
      lastErrorCode?: string;
      lastErrorMessageSafe?: string;
    },
  ): Promise<void> {
    await this.db
      .update(userIntegrations)
      .set({
        status,
        ...errorFields,
        updatedAt: new Date(),
      })
      .where(eq(userIntegrations.id, id));
  }

  async markRevoked(id: string): Promise<void> {
    await this.db
      .update(userIntegrations)
      .set({
        status: "revoked",
        keyHint: null,
        secretPath: "",
        lastErrorCode: null,
        lastErrorMessageSafe: null,
        updatedAt: new Date(),
      })
      .where(eq(userIntegrations.id, id));
  }
}
