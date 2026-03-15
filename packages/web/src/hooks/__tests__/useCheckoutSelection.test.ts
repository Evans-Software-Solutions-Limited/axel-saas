import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCheckoutSelection } from "../useCheckoutSelection";
import { createCheckoutSession } from "@/pages/subscribeApi";

vi.mock("@/pages/subscribeApi", () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test" }),
}));

const assignMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    value: { assign: assignMock },
    writable: true,
  });
});

describe("useCheckoutSelection", () => {
  it("initial state: no loading tier, no error", () => {
    const { result } = renderHook(() => useCheckoutSelection());
    expect(result.current.loadingTier).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("redirects to sales email for null tierId (Enterprise)", async () => {
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan(null);
    });
    expect(assignMock).toHaveBeenCalledWith("mailto:sales@axel.ai");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("calls createCheckoutSession and redirects on success", async () => {
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("pro");
    });
    expect(createCheckoutSession).toHaveBeenCalledWith("pro");
    expect(assignMock).toHaveBeenCalledWith(
      "https://checkout.stripe.com/pay/cs_test",
    );
  });

  it("sets loadingTier during checkout and clears it on error", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(
      new Error("Stripe unavailable"),
    );
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("starter");
    });
    expect(result.current.loadingTier).toBeNull();
    expect(result.current.error).toBe("Stripe unavailable");
  });

  it("uses fallback error message for non-Error throws", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce("unexpected");
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("starter");
    });
    expect(result.current.error).toBe("Failed to start checkout");
  });

  it("clears previous error before a new attempt", async () => {
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(new Error("first error"))
      .mockResolvedValueOnce({ url: "https://checkout.stripe.com/pay/cs_ok" });

    const { result } = renderHook(() => useCheckoutSelection());

    await act(async () => {
      await result.current.handleSelectPlan("starter");
    });
    expect(result.current.error).toBe("first error");

    await act(async () => {
      await result.current.handleSelectPlan("pro");
    });
    expect(result.current.error).toBeNull();
  });
});
