import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCheckoutSession } from "../subscribeApi";

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    core: {
      stripe: {
        "create-checkout-session": {
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
});
