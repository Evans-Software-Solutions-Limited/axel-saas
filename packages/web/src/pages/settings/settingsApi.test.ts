import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deleteAccount,
  fetchInvoices,
  fetchSubscriptionStatus,
  fetchUserProfile,
  openCustomerPortal,
  updateNotificationPreferences,
  updateProfileName,
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
      users: {
        me: Object.assign(
          { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
          { notifications: { put: vi.fn() } },
        ),
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
            cancelAtPeriodEnd: false,
          },
        },
        error: null,
      });

      const result = await fetchSubscriptionStatus();

      expect(result?.tier).toBe("premium");
      expect(result?.status).toBe("active");
      expect(result?.cancelAtPeriodEnd).toBe(false);
    });

    it("surfaces cancelAtPeriodEnd=true for portal-scheduled cancellations", async () => {
      mockApi.core.subscriptions.status.get.mockResolvedValue({
        data: {
          success: true,
          subscription: {
            tier: "premium",
            status: "active",
            currentPeriodEnd: "2026-05-15T00:00:00.000Z",
            cancelAtPeriodEnd: true,
          },
        },
        error: null,
      });

      const result = await fetchSubscriptionStatus();
      expect(result?.cancelAtPeriodEnd).toBe(true);
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

  describe("fetchUserProfile", () => {
    it("returns the profile with notification defaults filled in", async () => {
      // Server responses can omit the prefs entirely (legacy rows where
      // the column was just added with `{}`). The frontend has to fill
      // the keys so the toggles render in a consistent state.
      mockApi.core.users.me.get.mockResolvedValue({
        data: {
          success: true,
          user: {
            id: "u1",
            email: "user@example.com",
            fullName: "Ada",
            onboardingCompleted: true,
          },
        },
        error: null,
      });

      const profile = await fetchUserProfile();
      expect(profile.fullName).toBe("Ada");
      expect(profile.notificationPreferences).toEqual({
        emailNotifications: true,
        weeklyDigest: true,
      });
    });

    it("respects explicit values from the server", async () => {
      mockApi.core.users.me.get.mockResolvedValue({
        data: {
          success: true,
          user: {
            id: "u1",
            email: "user@example.com",
            fullName: null,
            onboardingCompleted: false,
            notificationPreferences: { emailNotifications: false },
          },
        },
        error: null,
      });

      const profile = await fetchUserProfile();
      expect(profile.notificationPreferences).toEqual({
        emailNotifications: false,
        weeklyDigest: true,
      });
    });

    it("throws on transport errors", async () => {
      mockApi.core.users.me.get.mockResolvedValue({
        data: null,
        error: { status: 500, value: { error: "boom" } },
      });
      await expect(fetchUserProfile()).rejects.toThrow(/500/);
    });

    it("throws when the body says success: false", async () => {
      mockApi.core.users.me.get.mockResolvedValue({
        data: { success: false },
        error: null,
      });
      await expect(fetchUserProfile()).rejects.toThrow(/not successful/i);
    });
  });

  describe("updateProfileName", () => {
    it("forwards the trimmed name and returns the updated profile", async () => {
      mockApi.core.users.me.put.mockResolvedValue({
        data: {
          success: true,
          user: {
            id: "u1",
            email: "user@example.com",
            fullName: "Ada Lovelace",
            onboardingCompleted: true,
            notificationPreferences: {},
          },
        },
        error: null,
      });

      const profile = await updateProfileName("Ada Lovelace");
      expect(profile.fullName).toBe("Ada Lovelace");
      expect(mockApi.core.users.me.put).toHaveBeenCalledWith({
        name: "Ada Lovelace",
      });
    });

    it("throws on transport errors", async () => {
      mockApi.core.users.me.put.mockResolvedValue({
        data: null,
        error: { status: 400, value: { error: "bad name" } },
      });
      await expect(updateProfileName("x")).rejects.toThrow(/400/);
    });

    it("throws when the body says success: false", async () => {
      mockApi.core.users.me.put.mockResolvedValue({
        data: { success: false },
        error: null,
      });
      await expect(updateProfileName("x")).rejects.toThrow(/not successful/i);
    });
  });

  describe("updateNotificationPreferences", () => {
    it("forwards a partial body and merges defaults into the response", async () => {
      mockApi.core.users.me.notifications.put.mockResolvedValue({
        data: {
          success: true,
          notificationPreferences: { emailNotifications: false },
        },
        error: null,
      });

      const next = await updateNotificationPreferences({
        emailNotifications: false,
      });
      expect(next).toEqual({
        emailNotifications: false,
        weeklyDigest: true,
      });
      expect(mockApi.core.users.me.notifications.put).toHaveBeenCalledWith({
        emailNotifications: false,
      });
    });

    it("throws on transport errors", async () => {
      mockApi.core.users.me.notifications.put.mockResolvedValue({
        data: null,
        error: { status: 500, value: { error: "boom" } },
      });
      await expect(
        updateNotificationPreferences({ emailNotifications: false }),
      ).rejects.toThrow(/500/);
    });
  });

  describe("deleteAccount", () => {
    it("resolves on success", async () => {
      mockApi.core.users.me.delete.mockResolvedValue({
        data: { success: true },
        error: null,
      });
      await expect(deleteAccount()).resolves.toBeUndefined();
    });

    it("surfaces a 'contact support' message on a 503 (auth admin not configured)", async () => {
      // Bugbot regression: distinct from the generic 500 / 502 because
      // there's no point asking the user to retry until the operator
      // sets SUPABASE_SERVICE_ROLE_KEY.
      mockApi.core.users.me.delete.mockResolvedValue({
        data: null,
        error: { status: 503, value: { error: "not configured" } },
      });
      await expect(deleteAccount()).rejects.toThrow(/contact support/i);
      await expect(deleteAccount()).rejects.not.toThrow(/please try again/i);
    });

    it("surfaces a friendly message on a 502 (Stripe failure)", async () => {
      mockApi.core.users.me.delete.mockResolvedValue({
        data: null,
        error: { status: 502, value: { error: "stripe boom" } },
      });
      await expect(deleteAccount()).rejects.toThrow(/payment provider/i);
    });

    it("surfaces a generic message on a 500", async () => {
      mockApi.core.users.me.delete.mockResolvedValue({
        data: null,
        error: { status: 500, value: { error: "boom" } },
      });
      await expect(deleteAccount()).rejects.toThrow(
        /try again or contact support/i,
      );
    });

    it("throws when the body says success: false", async () => {
      mockApi.core.users.me.delete.mockResolvedValue({
        data: { success: false },
        error: null,
      });
      await expect(deleteAccount()).rejects.toThrow(/not successful/i);
    });
  });
});
