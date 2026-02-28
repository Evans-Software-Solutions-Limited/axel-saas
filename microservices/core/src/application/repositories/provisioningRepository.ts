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
}

let _provisioningRepository: ProvisioningRepository | null = null;

export const getProvisioningRepository = (): ProvisioningRepository => {
  if (!_provisioningRepository) {
    _provisioningRepository = new ProvisioningRepository();
  }
  return _provisioningRepository;
};

// Export instance getter for backward compatibility
export const provisioningRepository = {
  findByUserId: (userId: string) =>
    getProvisioningRepository().findByUserId(userId),
  create: (input: NewProvisioningState) =>
    getProvisioningRepository().create(input),
  updateStatus: (
    provisioningId: string,
    status: ProvisioningStatus,
    errorMessage?: string,
  ) =>
    getProvisioningRepository().updateStatus(
      provisioningId,
      status,
      errorMessage,
    ),
  updateTaskArn: (provisioningId: string, ecsTaskArn: string) =>
    getProvisioningRepository().updateTaskArn(provisioningId, ecsTaskArn),
  updateProvisioned: (provisioningId: string, workspacePath: string) =>
    getProvisioningRepository().updateProvisioned(
      provisioningId,
      workspacePath,
    ),
} as const;
