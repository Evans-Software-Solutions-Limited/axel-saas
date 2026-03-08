import { describe, it, expect, vi, beforeEach } from "vitest";

// Set DATABASE_URL BEFORE any imports - this must happen at the very top
process.env.DATABASE_URL = "postgres://test:test@localhost/test";

// Mock the Stripe module
const mockStripeInstance = {
  invoices: {
    list: vi.fn(),
    retrieve: vi.fn(),
  },
};

vi.mock("stripe", () => ({
  default: vi.fn(() => mockStripeInstance),
}));

vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    returning: vi.fn(),
  })),
  subscriptionStatusEnum: {
    enumValues: ["active", "trialing", "past_due", "cancelled", "incomplete"],
  },
}));

vi.mock("@axel-saas/api-utils/jwt", () => ({
  unpackJWT: vi.fn(() => ({
    sub: "test-supabase-user-id",
    aud: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  })),
}));

// Mock userRepository - needs to be mocked BEFORE importing stripeHandler
const mockUserRepository = {
  getUserBySupabaseId: vi.fn(),
  updateOnboardingAnswers: vi.fn(),
  updateUser: vi.fn(),
};
vi.mock("../repositories/userRepository", () => ({
  userRepository: mockUserRepository,
}));

// Mock subscriptionRepository
const mockSubscriptionRepository = {
  findByUserId: vi.fn(),
  upsertByStripeCustomerId: vi.fn(),
  findByStripeCustomerId: vi.fn(),
  updateTier: vi.fn(),
  updatePeriodEnd: vi.fn(),
  updateStatus: vi.fn(),
};
vi.mock("../repositories/subscriptionRepository", () => ({
  SubscriptionRepository: vi.fn(() => mockSubscriptionRepository),
}));

vi.mock("../repositories/provisioningRepository", () => ({
  ProvisioningRepository: vi.fn(() => ({
    findByUserId: vi.fn(),
    create: vi.fn(),
  })),
}));

// Stub environment variables
vi.stubEnv("STRIPE_SECRET_KEY", "test_secret_key");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", "test_webhook_secret");
vi.stubEnv("STRIPE_PRICE_STARTER", "price_starter_123");
vi.stubEnv("STRIPE_PRICE_PRO", "price_pro_123");
vi.stubEnv("STRIPE_PRICE_BUSINESS", "price_business_123");
vi.stubEnv("STRIPE_PRICE_DEVELOPER", "price_developer_123");

import { stripeHandler } from "../stripeHandler";

describe("StripeHandler - Invoice Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Invoice Routes", () => {
    it("should have GET /stripe/invoices route", () => {
      const getRoutes = stripeHandler.routes.filter((r) => r.method === "GET");
      const invoicesRoute = getRoutes.find(
        (r) => r.path === "/stripe/invoices",
      );
      expect(invoicesRoute).toBeDefined();
    });

    it("should have GET /stripe/invoices/:id route", () => {
      const getRoutes = stripeHandler.routes.filter((r) => r.method === "GET");
      const invoiceRoute = getRoutes.find(
        (r) => r.path === "/stripe/invoices/:id",
      );
      expect(invoiceRoute).toBeDefined();
    });
  });

  describe("GET /stripe/invoices", () => {
    it("should require authorization header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices"),
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 when user has no subscription", async () => {
      // Setup mocks
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue(null);

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        invoices?: Array<{ id: string; number: string; status: string }>;
        invoice?: Record<string, unknown>;
        hasMore?: boolean;
      };
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("No subscription found");
    });

    it("should return invoices when user has subscription", async () => {
      // Setup mocks
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue({
        id: "sub-id",
        userId: "test-user-id",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        tier: "pro",
        status: "active",
      });

      const mockInvoices = {
        data: [
          {
            id: "inv_123",
            number: "INV-001",
            status: "paid",
            amount_due: 7900,
            amount_paid: 7900,
            currency: "gbp",
            created: 1704067200,
            due_date: null,
            invoice_pdf: "https://stripe.com/invoice.pdf",
            hosted_invoice_url: "https://stripe.com/invoice",
            period_start: 1701388800,
            period_end: 1704067200,
          },
        ],
        has_more: false,
      };

      mockStripeInstance.invoices.list.mockResolvedValue(mockInvoices);

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        invoices?: Array<{ id: string; number: string; status: string }>;
        invoice?: Record<string, unknown>;
        hasMore?: boolean;
      };
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invoices).toHaveLength(1);
      expect(data.invoices?.[0].id).toBe("inv_123");
      expect(data.invoices?.[0].number).toBe("INV-001");
      expect(data.hasMore).toBe(false);
    });

    it("should respect limit query parameter", async () => {
      // Setup mocks
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue({
        id: "sub-id",
        userId: "test-user-id",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        tier: "pro",
        status: "active",
      });

      mockStripeInstance.invoices.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices?limit=5", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      expect(mockStripeInstance.invoices.list).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_test123",
          limit: 5,
        }),
      );
    });

    it("should cap limit at 100", async () => {
      // Setup mocks
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue({
        id: "sub-id",
        userId: "test-user-id",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        tier: "pro",
        status: "active",
      });

      mockStripeInstance.invoices.list.mockResolvedValue({
        data: [],
        has_more: false,
      });

      await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices?limit=500", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      expect(mockStripeInstance.invoices.list).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        }),
      );
    });
  });

  describe("GET /stripe/invoices/:id", () => {
    it("should require authorization header", async () => {
      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices/inv_123"),
      );
      expect(response.status).toBe(401);
    });

    it("should return 404 when user has no subscription", async () => {
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue(null);

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices/inv_123", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        invoices?: Array<{ id: string; number: string; status: string }>;
        invoice?: Record<string, unknown>;
        hasMore?: boolean;
      };
      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe("No subscription found");
    });

    it("should return 403 when invoice belongs to different customer", async () => {
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue({
        id: "sub-id",
        userId: "test-user-id",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        tier: "pro",
        status: "active",
      });

      mockStripeInstance.invoices.retrieve.mockResolvedValue({
        id: "inv_123",
        customer: "cus_different",
      });

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices/inv_123", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      expect(response.status).toBe(403);
    });

    it("should return invoice when it belongs to user", async () => {
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue({
        id: "sub-id",
        userId: "test-user-id",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        tier: "pro",
        status: "active",
      });

      const mockInvoice = {
        id: "inv_123",
        number: "INV-001",
        status: "paid",
        amount_due: 7900,
        amount_paid: 7900,
        amount_remaining: 0,
        currency: "gbp",
        created: 1704067200,
        due_date: null,
        invoice_pdf: "https://stripe.com/invoice.pdf",
        hosted_invoice_url: "https://stripe.com/invoice",
        period_start: 1701388800,
        period_end: 1704067200,
        customer: "cus_test123",
        subscription: "sub_test123",
        lines: {
          data: [
            {
              id: "line_1",
              description: "Pro Plan",
              amount: 7900,
              quantity: 1,
              unit_amount: 7900,
              period: {
                start: 1701388800,
                end: 1704067200,
              },
            },
          ],
        },
      };

      mockStripeInstance.invoices.retrieve.mockResolvedValue(mockInvoice);

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices/inv_123", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        invoices?: Array<{ id: string; number: string; status: string }>;
        invoice?: { id: string; lines?: Array<{ description: string }> };
        hasMore?: boolean;
      };
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.invoice?.id).toBe("inv_123");
      expect(data.invoice?.lines).toHaveLength(1);
      expect(data.invoice?.lines?.[0]?.description).toBe("Pro Plan");
    });

    it("should return 404 for non-existent invoice", async () => {
      mockUserRepository.getUserBySupabaseId.mockResolvedValue({
        id: "test-user-id",
        email: "test@example.com",
      });
      mockSubscriptionRepository.findByUserId.mockResolvedValue({
        id: "sub-id",
        userId: "test-user-id",
        stripeCustomerId: "cus_test123",
        stripeSubscriptionId: "sub_test123",
        tier: "pro",
        status: "active",
      });

      const stripeError = new Error("Invoice not found") as Error & {
        type: string;
      };
      stripeError.type = "StripeInvalidRequestError";
      mockStripeInstance.invoices.retrieve.mockRejectedValue(stripeError);

      const response = await stripeHandler.handle(
        new Request("http://localhost/stripe/invoices/inv_nonexistent", {
          headers: {
            Authorization: "Bearer valid-test-token",
          },
        }),
      );

      expect(response.status).toBe(404);
    });
  });
});
