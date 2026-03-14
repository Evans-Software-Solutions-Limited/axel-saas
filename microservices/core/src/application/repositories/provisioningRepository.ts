import { eq } from "drizzle-orm";
import {
  type Db,
  type ProvisioningState,
  type NewProvisioningState,
  provisioningState,
  provisioningStatusEnum,
  getDb,
} from "@axel-saas/db";

export type ProvisioningStatus =
  (typeof provisioningStatusEnum.enumValues)[number];

export class ProvisioningRepository {
  static readonly key = "ProvisioningRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  async findByUserId(userId: string): Promise<ProvisioningState | null> {
    const [row] = await this.db
      .select()
      .from(provisioningState)
      .where(eq(provisioningState.userId, userId))
      .limit(1);
    return row || null;
  }

  async create(input: NewProvisioningState): Promise<ProvisioningState> {
    const [row] = await this.db
      .insert(provisioningState)
      .values(input)
      .returning();
    if (!row)
      throw new Error("Failed to create provisioning state — no row returned");
    return row;
  }

  async updateStatus(
    provisioningId: string,
    status: ProvisioningStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.db
      .update(provisioningState)
      .set({ status, errorMessage, updatedAt: new Date() })
      .where(eq(provisioningState.id, provisioningId));
  }

  async updateTaskArn(
    provisioningId: string,
    ecsTaskArn: string,
  ): Promise<void> {
    await this.db
      .update(provisioningState)
      .set({ ecsTaskArn, updatedAt: new Date() })
      .where(eq(provisioningState.id, provisioningId));
  }

  async updateProvisioned(
    provisioningId: string,
    workspacePath: string,
  ): Promise<void> {
    await this.db
      .update(provisioningState)
      .set({
        status: "active" as const,
        workspacePath,
        provisionedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(provisioningState.id, provisioningId));
  }

  /**
   * Update gateway URL for a user's container
   */
  async updateGatewayUrl(userId: string, gatewayUrl: string): Promise<void> {
    const existing = await this.findByUserId(userId);
    if (existing) {
      await this.db
        .update(provisioningState)
        .set({ gatewayUrl, updatedAt: new Date() })
        .where(eq(provisioningState.userId, userId));
    }
  }

  /**
   * Atomically set gateway URL and mark provisioning as active.
   * Called when a container reports it is ready to serve traffic.
   */
  async activateGateway(userId: string, gatewayUrl: string): Promise<void> {
    await this.db
      .update(provisioningState)
      .set({
        gatewayUrl,
        status: "active" as const,
        provisionedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(provisioningState.userId, userId));
  }

  /**
   * Get container by user ID - returns gateway URL if available
   */
  async getContainerByUserId(userId: string): Promise<{
    taskArn: string | null;
    status: ProvisioningStatus | null;
    gatewayUrl: string | null;
    workspacePath: string | null;
  } | null> {
    const row = await this.findByUserId(userId);
    if (!row) return null;
    return {
      taskArn: row.ecsTaskArn,
      status: row.status,
      gatewayUrl: row.gatewayUrl,
      workspacePath: row.workspacePath,
    };
  }
}
