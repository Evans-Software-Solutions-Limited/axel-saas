import { describe, it, expect, vi, beforeEach } from "vitest";

// Set DATABASE_URL BEFORE any imports - required by getDb at module load.
process.env.DATABASE_URL = "postgres://test:test@localhost/test";

const { mockStripeInstance, mockUserRepository, mockSubscriptionRepository } =
  vi.hoisted(() => ({
    mockStripeInstance: {
      billingPortal: {
        sessions: {
          create: vi.fn(),
        },
      },
      invoices: { list: vi.fn(), retrieve: vi.fn() },
    },
    mockUserRepository: {
      getUserBySupabaseId: vi.fn(),
      updateOnboardingAnswers: vi.fn(),
      updateUser: vi.fn(),
    },
    mockSubscriptionRepository: {
      findByUserId: vi.fn(),
      upsertByStripeCustomerId: vi.fn(),
      findByStripeCustomerId: vi.fn(),
      updateTier: vi.fn(),
      updatePeriodEnd: vi.fn(),
      updateStatus: vi.fn(),
    },
  }));

vi.mock("stripe", () => ({
  default: vi.fn(() => mockStripeInstance),
}));

vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

vi.mock("@axel-saas/api-utils/auth/supabaseAuth", () => ({
  getAuthUser: vi.fn(() =>
    Promise.resolve({
      sub: "test-supabase-user-id",
      email: "test@example.com",
      email_verified: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ),
  requireAuth: vi.fn(
    ({ user, set }: { user: unknown; set: { status?: number } }) => {
      if (!user) {
        set.status = 401;
        return { success: false, error: "Unauthorized" };
      }
    },
  ),
  getUser: vi.fn((ctx: object) => (ctx as { user: { sub: string } }).user),
}));

vi.mock("../../repositories/userRepository", () => ({
  userRepository: mockUserRepository,
}));

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn(() => mockSubscriptionRepository),
}));

vi.mock("../../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn(() => ({
    findByUserId: vi.fn(),
    create: vi.fn(),
  })),
}));

vi.stubEnv("STRIPE_SECRET_KEY", "test_secret_key");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test_webhook_secret");
vi.stubEnv("VITE_WEB_URL", "http://localhost:5173");

import { stripeHandler } from "../stripeHandler";

const portalRequest = (body: unknown = undefined) =>
  new Request("http://localhost/stripe/customer-portal", {
    method: "POST",
    headers: {
      Authorization: "Bearer valid-test-token",
      "Content-Type": "application/json",
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

describe("StripeHandler - POST /stripe/customer-portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the route on the protected handler", () => {
    const route = stripeHandler.routes.find(
      (r) => r.method === "POST" && r.path === "/stripe/customer-portal",
    );
    expect(route).toBeDefined();
  });

  it("returns 401 without an authorization header", async () => {
    const { getAuthUser } =
      await import("@axel-saas/api-utils/auth/supabaseAuth");
    vi.mocked(getAuthUser).mockResolvedValueOnce(null);

    const response = await stripeHandler.handle(
      new Request("http://localhost/stripe/customer-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 when the user record is missing", async () => {
    mockUserRepository.getUserBySupabaseId.mockResolvedValue(null);

    const response = await stripeHandler.handle(portalRequest({}));

    expect(response.status).toBe(404);
    expect(
      mockStripeInstance.billingPortal.sessions.create,
    ).not.toHaveBeenCalled();
  });

  it("returns 404 when the user has no Stripe customer (free tier)", async () => {
    // Free-tier rows store no stripeCustomerId. The frontend hides the CTA,
    // but defend the API in case a client calls anyway.
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: null,
      tier: "free",
      status: "active",
    });

    const response = await stripeHandler.handle(portalRequest({}));

    expect(response.status).toBe(404);
    const data = (await response.json()) as { error: string };
    expect(data.error).toMatch(/no stripe customer/i);
    expect(
      mockStripeInstance.billingPortal.sessions.create,
    ).not.toHaveBeenCalled();
  });

  it("returns 400 for an unsupported flow value", async () => {
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test123",
      tier: "premium",
      status: "active",
    });

    const response = await stripeHandler.handle(
      portalRequest({ flow: "delete-everything" }),
    );

    expect(response.status).toBe(400);
    expect(
      mockStripeInstance.billingPortal.sessions.create,
    ).not.toHaveBeenCalled();
  });

  it("creates a default portal session and returns its URL", async () => {
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test123",
      tier: "premium",
      status: "active",
    });
    mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_default",
    });

    const response = await stripeHandler.handle(portalRequest({}));

    expect(response.status).toBe(200);
    const data = (await response.json()) as { success: boolean; url: string };
    expect(data.success).toBe(true);
    expect(data.url).toBe("https://billing.stripe.com/p/session/test_default");

    expect(
      mockStripeInstance.billingPortal.sessions.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_test123",
        return_url: "http://localhost:5173/dashboard/settings",
      }),
    );
    // Default flow has no flow_data — Stripe shows the standard portal home.
    const call =
      mockStripeInstance.billingPortal.sessions.create.mock.calls[0]?.[0];
    expect((call as { flow_data?: unknown }).flow_data).toBeUndefined();
  });

  it("creates a cancel-flow portal session when flow=cancel", async () => {
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test123",
      tier: "premium",
      status: "active",
    });
    mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_cancel",
    });

    const response = await stripeHandler.handle(
      portalRequest({ flow: "cancel" }),
    );

    expect(response.status).toBe(200);
    expect(
      mockStripeInstance.billingPortal.sessions.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_test123",
        flow_data: {
          type: "subscription_cancel",
          subscription_cancel: { subscription: "sub_test123" },
        },
      }),
    );
  });

  it("falls back to the default flow when flow=cancel but no Stripe subscription ID exists", async () => {
    // Edge case: stripeCustomerId present but stripeSubscriptionId null. Don't
    // pass flow_data with an undefined subscription — Stripe would 400. Drop
    // back to the standard portal so the user lands somewhere useful.
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: null,
      tier: "premium",
      status: "active",
    });
    mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p/session/test_fallback",
    });

    await stripeHandler.handle(portalRequest({ flow: "cancel" }));

    const call =
      mockStripeInstance.billingPortal.sessions.create.mock.calls[0]?.[0];
    expect((call as { flow_data?: unknown }).flow_data).toBeUndefined();
  });

  it("returns 500 when Stripe returns a session with no URL", async () => {
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test123",
      tier: "premium",
      status: "active",
    });
    mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
      url: null,
    });

    const response = await stripeHandler.handle(portalRequest({}));
    expect(response.status).toBe(500);
  });

  it("returns 500 when Stripe throws", async () => {
    mockUserRepository.getUserBySupabaseId.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
    });
    mockSubscriptionRepository.findByUserId.mockResolvedValue({
      id: "sub-1",
      userId: "user-1",
      stripeCustomerId: "cus_test123",
      stripeSubscriptionId: "sub_test123",
      tier: "premium",
      status: "active",
    });
    mockStripeInstance.billingPortal.sessions.create.mockRejectedValue(
      new Error("Stripe down"),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await stripeHandler.handle(portalRequest({}));

    expect(response.status).toBe(500);
    errorSpy.mockRestore();
  });
});
