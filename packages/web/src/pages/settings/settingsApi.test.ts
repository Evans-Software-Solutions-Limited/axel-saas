import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchInvoices,
  fetchSubscriptionStatus,
  openCustomerPortal,
} from "./settingsApi";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    core: {
      subscriptions: {
        status: { get: vi.fn() },
      },
      stripe: {
        invoices: { get: vi.fn() },
        "customer-portal": { post: vi.fn() },
      },
    },
  },
}));

vi.mock("@/lib/eden", () => ({
  api: mockApi,
}));

describe("settingsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSubscriptionStatus", () => {
    it("returns the subscription when present", async () => {
      mockApi.core.subscriptions.status.get.mockResolvedValue({
        data: {
          success: true,
          subscription: {
            tier: "premium",
            status: "active",
            currentPeriodEnd: "2026-05-15T00:00:00.000Z",
          },
        },
        error: null,
      });

      const result = await fetchSubscriptionStatus();

      expect(result?.tier).toBe("premium");
      expect(result?.status).toBe("active");
    });

    it("returns null when the user has no subscription row", async () => {
      mockApi.core.subscriptions.status.get.mockResolvedValue({
        data: { success: true, subscription: null },
        error: null,
      });

      const result = await fetchSubscriptionStatus();
      expect(result).toBeNull();
    });

    it("throws when Eden returns response.error", async () => {
      mockApi.core.subscriptions.status.get.mockResolvedValue({
        data: null,
        error: { status: 500, value: { error: "boom" } },
      });

      await expect(fetchSubscriptionStatus()).rejects.toThrow(/500/);
    });

    it("throws when the body says success: false", async () => {
      mockApi.core.subscriptions.status.get.mockResolvedValue({
        data: { success: false },
        error: null,
      });

      await expect(fetchSubscriptionStatus()).rejects.toThrow(
        /not successful/i,
      );
    });
  });

  describe("fetchInvoices", () => {
    it("returns invoices on success", async () => {
      mockApi.core.stripe.invoices.get.mockResolvedValue({
        data: {
          success: true,
          invoices: [{ id: "inv_1", amountPaid: 4900, currency: "gbp" }],
        },
        error: null,
      });

      const result = await fetchInvoices();
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("inv_1");
    });

    it("forwards the limit query param to the API", async () => {
      mockApi.core.stripe.invoices.get.mockResolvedValue({
        data: { success: true, invoices: [] },
        error: null,
      });
      await fetchInvoices(5);
      expect(mockApi.core.stripe.invoices.get).toHaveBeenCalledWith({
        query: { limit: "5" },
      });
    });

    it("returns an empty array when the user has no Stripe customer (404)", async () => {
      // Free-tier users hit 404 on /stripe/invoices — surface as empty list.
      mockApi.core.stripe.invoices.get.mockResolvedValue({
        data: null,
        error: { status: 404, value: { error: "No subscription found" } },
      });

      const result = await fetchInvoices();
      expect(result).toEqual([]);
    });

    it("throws on non-404 errors", async () => {
      mockApi.core.stripe.invoices.get.mockResolvedValue({
        data: null,
        error: { status: 500, value: { error: "Stripe down" } },
      });

      await expect(fetchInvoices()).rejects.toThrow(/500/);
    });

    it("throws when the body says success: false", async () => {
      // 200 OK with success:false should surface as an error rather than
      // silently rendering an empty invoices list. Matches the
      // fetchSubscriptionStatus / openCustomerPortal pattern.
      mockApi.core.stripe.invoices.get.mockResolvedValue({
        data: { success: false, invoices: [] },
        error: null,
      });

      await expect(fetchInvoices()).rejects.toThrow(/not successful/i);
    });
  });

  describe("openCustomerPortal", () => {
    it("returns the portal URL on default flow (no body)", async () => {
      mockApi.core.stripe["customer-portal"].post.mockResolvedValue({
        data: {
          success: true,
          url: "https://billing.stripe.com/p/session/default",
        },
        error: null,
      });

      const result = await openCustomerPortal();
      expect(result.url).toBe("https://billing.stripe.com/p/session/default");
      // Default flow sends an empty body — keeps Eden's body type happy
      // without leaking a literal `undefined`.
      expect(mockApi.core.stripe["customer-portal"].post).toHaveBeenCalledWith(
        {},
      );
    });

    it("forwards flow=cancel to the API", async () => {
      mockApi.core.stripe["customer-portal"].post.mockResolvedValue({
        data: {
          success: true,
          url: "https://billing.stripe.com/p/session/cancel",
        },
        error: null,
      });

      await openCustomerPortal("cancel");
      expect(mockApi.core.stripe["customer-portal"].post).toHaveBeenCalledWith({
        flow: "cancel",
      });
    });

    it("throws on response.error", async () => {
      mockApi.core.stripe["customer-portal"].post.mockResolvedValue({
        data: null,
        error: { status: 404, value: { error: "No Stripe customer" } },
      });

      await expect(openCustomerPortal()).rejects.toThrow(/404/);
    });

    it("throws when the URL is missing from the response", async () => {
      mockApi.core.stripe["customer-portal"].post.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await expect(openCustomerPortal()).rejects.toThrow(/missing a url/i);
    });
  });
});
