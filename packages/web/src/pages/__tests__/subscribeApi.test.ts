import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession, provisionFreeSilently } from "../subscribeApi";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    core: {
      stripe: {
        "create-checkout-session": {
          post: vi.fn(),
        },
      },
      subscriptions: {
        free: {
          post: vi.fn(),
        },
      },
    },
  },
}));

vi.mock("@/lib/eden", () => ({
  api: mockApi,
}));

describe("subscribeApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCheckoutSession", () => {
    it("returns url when API call succeeds", async () => {
      mockApi.core.stripe["create-checkout-session"].post.mockResolvedValue({
        data: { url: "https://checkout.stripe.com/pay/cs_test_123" },
      } as never);

      const result = await createCheckoutSession("premium");

      expect(result).toEqual({
        url: "https://checkout.stripe.com/pay/cs_test_123",
      });
    });

    it("passes tier to the API", async () => {
      mockApi.core.stripe["create-checkout-session"].post.mockResolvedValue({
        data: { url: "https://checkout.stripe.com/pay/cs_premium" },
      } as never);

      await createCheckoutSession("premium");

      expect(
        mockApi.core.stripe["create-checkout-session"].post,
      ).toHaveBeenCalledWith({ tier: "premium" });
    });

    it("throws when API returns an error object", async () => {
      mockApi.core.stripe["create-checkout-session"].post.mockResolvedValue({
        data: { error: { status: 400, message: "Invalid tier" } },
      } as never);

      await expect(createCheckoutSession("bad")).rejects.toThrow();
    });

    it("throws with default message when response has no url", async () => {
      mockApi.core.stripe["create-checkout-session"].post.mockResolvedValue({
        data: {},
      } as never);

      await expect(createCheckoutSession("premium")).rejects.toThrow(
        "Failed to create checkout session",
      );
    });
  });

  describe("provisionFreeSilently", () => {
    it("resolves without warning on a successful response", async () => {
      mockApi.core.subscriptions.free.post.mockResolvedValue({
        data: { success: true, subscription: { tier: "free" } },
        error: null,
      } as never);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(provisionFreeSilently()).resolves.toBeUndefined();
      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("warns and resolves when Eden returns response.error (HTTP error path)", async () => {
      // Eden treaty resolves with `{ data, error }` on HTTP failures rather
      // than throwing. The 401 from the email-confirmation flow lands here.
      mockApi.core.subscriptions.free.post.mockResolvedValue({
        data: null,
        error: { status: 401, value: { error: "Unauthorized" } },
      } as never);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(provisionFreeSilently()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[free-tier] provisioning deferred:",
        expect.objectContaining({ status: 401 }),
      );
      warnSpy.mockRestore();
    });

    it("warns and resolves when the call throws (network failure)", async () => {
      mockApi.core.subscriptions.free.post.mockRejectedValue(
        new Error("Network down"),
      );
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      await expect(provisionFreeSilently()).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        "[free-tier] provisioning deferred:",
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });
});
