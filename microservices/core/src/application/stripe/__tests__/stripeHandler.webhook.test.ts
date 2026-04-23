import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConstructEvent = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: { sessions: { create: vi.fn() } },
    customers: { create: vi.fn() },
    webhooks: { constructEvent: mockConstructEvent },
    invoices: { list: vi.fn(), retrieve: vi.fn() },
  })),
}));

vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

const mockUpsert = vi.fn();
const mockFindByStripeCustomer = vi.fn();
const mockUpdateTier = vi.fn();
const mockUpdatePeriodEnd = vi.fn();
const mockUpdateStatus = vi.fn();

vi.mock("../../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn().mockImplementation(() => ({
    upsertByStripeCustomerId: mockUpsert,
    findByStripeCustomerId: mockFindByStripeCustomer,
    updateTier: mockUpdateTier,
    updatePeriodEnd: mockUpdatePeriodEnd,
    updateStatus: mockUpdateStatus,
  })),
}));

const mockProvFindByUserId = vi.fn();
const mockProvCreate = vi.fn();
vi.mock("../../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn().mockImplementation(() => ({
    findByUserId: mockProvFindByUserId,
    create: mockProvCreate,
  })),
}));

vi.mock("../../repositories/userRepository", () => ({
  userRepository: { getUserBySupabaseId: vi.fn() },
}));

const mockTriggerContainerLaunch = vi.fn().mockResolvedValue(undefined);
vi.mock("../../provisioning/provisioningService", () => ({
  triggerContainerLaunch: (...args: unknown[]) =>
    mockTriggerContainerLaunch(...args),
  resolveWorkspacePath: (userId: string) => `/workspaces/${userId}`,
}));

vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
vi.stubEnv("STRIPE_PRICE_PREMIUM", "price_premium_test");
vi.stubEnv("VITE_WEB_URL", "http://localhost:5173");

import { stripeHandler } from "../stripeHandler";

// Elysia parses request body as JSON by default, so the body must be valid JSON
// even though the handler treats it as an opaque string for Stripe signature
// verification. The mocked constructEvent returns canned event data regardless.
function postWebhook(body: string = "{}") {
  return stripeHandler.handle(
    new Request("http://localhost/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": "sig_test_1234567890",
      },
      body,
    }),
  );
}

describe("StripeHandler webhook behaviour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTriggerContainerLaunch.mockResolvedValue(undefined);
  });

  describe("checkout.session.completed", () => {
    it("upserts the subscription as premium/active and creates provisioning when missing", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_abc",
            expires_at: 1_800_000_000,
            metadata: { userId: "user-1", tier: "premium" },
          },
        },
      });
      mockProvFindByUserId.mockResolvedValueOnce(null);

      const response = await postWebhook();

      expect(response.status).toBe(200);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_abc",
          tier: "premium",
          status: "active",
        }),
      );
      expect(mockProvCreate).toHaveBeenCalledWith({
        userId: "user-1",
        status: "pending",
      });
      expect(mockTriggerContainerLaunch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: "user-1",
          tier: "premium",
          workspacePath: "/workspaces/user-1",
        }),
      );
    });

    it("does not re-create provisioning state when one already exists", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_abc",
            metadata: { userId: "user-1", tier: "premium" },
          },
        },
      });
      mockProvFindByUserId.mockResolvedValueOnce({ id: "prov-existing" });

      await postWebhook();

      expect(mockProvCreate).not.toHaveBeenCalled();
      expect(mockTriggerContainerLaunch).toHaveBeenCalled();
    });

    it("returns 500 when checkout session metadata is missing required fields", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_abc",
            metadata: null,
          },
        },
      });

      const response = await postWebhook();
      expect(response.status).toBe(500);
      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it("swallows provisioning errors so Stripe receives a 200 (no retry)", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_abc",
            metadata: { userId: "user-1", tier: "premium" },
          },
        },
      });
      mockProvFindByUserId.mockResolvedValueOnce(null);
      mockTriggerContainerLaunch.mockRejectedValueOnce(new Error("ECS down"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await postWebhook();
      expect(response.status).toBe(200);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates tier and period end when both are present in the event", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_999",
            current_period_end: 1_900_000_000,
            status: "active",
            items: {
              data: [
                {
                  price: { metadata: { tier: "premium" } },
                },
              ],
            },
          },
        },
      });
      mockFindByStripeCustomer.mockResolvedValueOnce({
        id: "sub-row-1",
        status: "trialing",
      });

      const response = await postWebhook();

      expect(response.status).toBe(200);
      expect(mockUpdateTier).toHaveBeenCalledWith("sub-row-1", "premium");
      expect(mockUpdatePeriodEnd).toHaveBeenCalledWith(
        "sub-row-1",
        new Date(1_900_000_000 * 1000),
      );
      expect(mockUpdateStatus).toHaveBeenCalledWith("sub-row-1", "active");
    });

    it("maps the Stripe 'canceled' status to the DB 'cancelled' value", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_999",
            status: "canceled",
            items: { data: [] },
          },
        },
      });
      mockFindByStripeCustomer.mockResolvedValueOnce({
        id: "sub-row-1",
        status: "active",
      });

      await postWebhook();
      expect(mockUpdateStatus).toHaveBeenCalledWith("sub-row-1", "cancelled");
    });

    it("is a no-op when no matching subscription row is found", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "customer.subscription.updated",
        data: {
          object: {
            customer: "cus_unknown",
            status: "active",
            items: { data: [] },
          },
        },
      });
      mockFindByStripeCustomer.mockResolvedValueOnce(null);

      const response = await postWebhook();
      expect(response.status).toBe(200);
      expect(mockUpdateStatus).not.toHaveBeenCalled();
      expect(mockUpdateTier).not.toHaveBeenCalled();
    });
  });

  describe("customer.subscription.deleted", () => {
    it("marks the matching subscription row as cancelled", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "customer.subscription.deleted",
        data: { object: { customer: "cus_del" } },
      });
      mockFindByStripeCustomer.mockResolvedValueOnce({ id: "sub-del" });

      const response = await postWebhook();
      expect(response.status).toBe(200);
      expect(mockUpdateStatus).toHaveBeenCalledWith("sub-del", "cancelled");
    });
  });

  describe("invoice.payment_failed", () => {
    it("marks the matching subscription as past_due", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "invoice.payment_failed",
        data: { object: { customer: "cus_pd" } },
      });
      mockFindByStripeCustomer.mockResolvedValueOnce({ id: "sub-pd" });

      const response = await postWebhook();
      expect(response.status).toBe(200);
      expect(mockUpdateStatus).toHaveBeenCalledWith("sub-pd", "past_due");
    });
  });

  describe("unknown event types", () => {
    it("returns 200 without touching any repository", async () => {
      mockConstructEvent.mockReturnValueOnce({
        type: "unknown.event.type",
        data: { object: {} },
      });

      const response = await postWebhook();
      expect(response.status).toBe(200);
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockUpdateStatus).not.toHaveBeenCalled();
      expect(mockUpdateTier).not.toHaveBeenCalled();
    });
  });
});
