import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountDeletionService } from "../accountDeletionService";
import type { UserRepository } from "../../repositories/userRepository";
import type { SubscriptionRepository } from "../../repositories/subscriptionRepository";

interface MockedSubscription {
  id: string;
  stripeSubscriptionId: string | null;
}

interface Deps {
  service: AccountDeletionService;
  userRepo: {
    getUserBySupabaseId: ReturnType<typeof vi.fn>;
    deleteById: ReturnType<typeof vi.fn>;
  };
  subscriptionRepo: { findByUserId: ReturnType<typeof vi.fn> };
  stripeCancel: ReturnType<typeof vi.fn>;
  deleteAuthUser: ReturnType<typeof vi.fn>;
  logger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
}

const DEFAULT_DB_USER = {
  id: "db-1",
  supabaseUserId: "auth-1",
  email: "user@example.com",
  fullName: "Test User",
  onboardingCompleted: true,
  notificationPreferences: {},
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

function makeService(
  options: {
    subscription?: MockedSubscription | null;
    deleteResult?: boolean;
    stripeError?: { code?: string; statusCode?: number; message?: string };
    deleteAuthResult?: {
      success: boolean;
      alreadyRemoved?: boolean;
      status?: number;
      error?: string;
    };
    deleteByIdError?: Error;
    omitStripe?: boolean;
    /** When `null`, simulate the orphan-cleanup retry path (DB row
     * already gone from a prior partial-failure attempt). */
    dbUser?: typeof DEFAULT_DB_USER | null;
  } = {},
): Deps {
  const dbUser =
    options.dbUser === undefined ? DEFAULT_DB_USER : options.dbUser;
  const userRepo = {
    getUserBySupabaseId: vi.fn().mockResolvedValue(dbUser),
    deleteById: vi.fn().mockResolvedValue(options.deleteResult ?? true),
  };
  if (options.deleteByIdError) {
    userRepo.deleteById.mockRejectedValueOnce(options.deleteByIdError);
  }
  const subscriptionRepo = {
    findByUserId: vi
      .fn()
      .mockResolvedValue(
        options.subscription === undefined
          ? { id: "sub-1", stripeSubscriptionId: "sub_stripe_1" }
          : options.subscription,
      ),
  };
  const stripeCancel = vi.fn();
  if (options.stripeError) {
    stripeCancel.mockRejectedValueOnce(options.stripeError);
  } else {
    stripeCancel.mockResolvedValue({ id: "sub_stripe_1", status: "canceled" });
  }
  const deleteAuthUser = vi
    .fn()
    .mockResolvedValue(options.deleteAuthResult ?? { success: true });
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const service = new AccountDeletionService({
    userRepo: userRepo as unknown as UserRepository,
    subscriptionRepo: subscriptionRepo as unknown as SubscriptionRepository,
    stripe: options.omitStripe
      ? undefined
      : ({ subscriptions: { cancel: stripeCancel } } as never),
    deleteAuthUser,
    logger,
  });
  return {
    service,
    userRepo,
    subscriptionRepo,
    stripeCancel,
    deleteAuthUser,
    logger,
  };
}

describe("AccountDeletionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("cancels Stripe, deletes the DB row, and removes the auth user", async () => {
    const deps = makeService();

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(deps.stripeCancel).toHaveBeenCalledWith("sub_stripe_1");
    expect(deps.userRepo.deleteById).toHaveBeenCalledWith("db-1");
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth-1");

    // Order: Stripe → DB → auth. If we ever flip to running auth first
    // we'd risk orphaning users in auth.users with no app row, which
    // breaks /users/me forever — pin the order via an invocation index.
    const stripeOrder = deps.stripeCancel.mock.invocationCallOrder[0]!;
    const dbOrder = deps.userRepo.deleteById.mock.invocationCallOrder[0]!;
    const authOrder = deps.deleteAuthUser.mock.invocationCallOrder[0]!;
    expect(stripeOrder).toBeLessThan(dbOrder);
    expect(dbOrder).toBeLessThan(authOrder);
  });

  it("skips Stripe when the user has no subscription", async () => {
    const deps = makeService({ subscription: null });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(deps.stripeCancel).not.toHaveBeenCalled();
  });

  it("skips Stripe when the subscription has no stripeSubscriptionId (free tier)", async () => {
    const deps = makeService({
      subscription: { id: "sub-1", stripeSubscriptionId: null },
    });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(deps.stripeCancel).not.toHaveBeenCalled();
  });

  it("treats Stripe 404 as already-cancelled and continues", async () => {
    const deps = makeService({
      stripeError: { code: "resource_missing", statusCode: 404 },
    });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(deps.userRepo.deleteById).toHaveBeenCalledWith("db-1");
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth-1");
  });

  it("aborts on a real Stripe error and does NOT delete the DB row or the auth row", async () => {
    const deps = makeService({
      stripeError: { statusCode: 500, message: "stripe boom" },
    });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("stripe_cancel_failed");
    expect(deps.userRepo.deleteById).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("returns db_delete_failed when the DB delete throws", async () => {
    const deps = makeService({ deleteByIdError: new Error("db down") });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("db_delete_failed");
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("continues when the DB row is already gone (idempotent retry)", async () => {
    const deps = makeService({ deleteResult: false });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth-1");
  });

  it("returns auth_delete_failed when the Supabase admin call fails", async () => {
    const deps = makeService({
      deleteAuthResult: { success: false, status: 500, error: "auth boom" },
    });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("auth_delete_failed");
  });

  it("treats an already-removed auth row as success", async () => {
    const deps = makeService({
      deleteAuthResult: { success: true, alreadyRemoved: true, status: 404 },
    });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
  });

  it("runs orphan-cleanup (auth-only) when the DB row is already gone", async () => {
    // Bugbot regression: a prior partial-failure (Stripe + DB cascade
    // succeeded, the auth-admin call timed out) leaves the auth.users
    // row orphaned. A retry of DELETE /users/me must NOT short-circuit
    // on the missing DB row — it must still call deleteAuthUser to
    // finish the cleanup.
    const deps = makeService({ dbUser: null });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(result.orphanCleanup).toBe(true);
    // Stripe + DB are both skipped — the user row was already gone.
    expect(deps.subscriptionRepo.findByUserId).not.toHaveBeenCalled();
    expect(deps.stripeCancel).not.toHaveBeenCalled();
    expect(deps.userRepo.deleteById).not.toHaveBeenCalled();
    // Auth-admin is invoked so the orphan is finally removed.
    expect(deps.deleteAuthUser).toHaveBeenCalledWith("auth-1");
  });

  it("returns orphanCleanup: true on auth-delete failure during the retry path", async () => {
    // The orphan-cleanup branch must still surface auth_delete_failed
    // so the caller knows the retry is unfinished.
    const deps = makeService({
      dbUser: null,
      deleteAuthResult: { success: false, status: 500, error: "auth boom" },
    });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(false);
    expect(result.reason).toBe("auth_delete_failed");
    expect(result.orphanCleanup).toBe(true);
  });

  it("logs and continues when no Stripe client is available and STRIPE_SECRET_KEY is unset", async () => {
    const deps = makeService({ omitStripe: true });

    const result = await deps.service.deleteAccount({
      supabaseUserId: "auth-1",
    });

    expect(result.success).toBe(true);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      "stripe_secret_unavailable_skipping_cancel",
      expect.any(Object),
    );
  });
});
