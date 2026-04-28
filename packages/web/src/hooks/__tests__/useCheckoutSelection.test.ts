import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCheckoutSelection } from "../useCheckoutSelection";
import {
  createCheckoutSession,
  provisionFreeSilently,
} from "@/pages/subscribeApi";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/pages/subscribeApi", () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test" }),
  provisionFreeSilently: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const assignMock = vi.fn();

const mockAuthValue = (overrides: { isAuthenticated?: boolean } = {}) =>
  ({
    isAuthenticated: false,
    isLoading: false,
    onboardingCompleted: false,
    user: null,
    session: null,
    error: null,
    setOnboardingCompleted: vi.fn(),
    refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue({ success: true }),
    signUp: vi.fn().mockResolvedValue({ success: true }),
    signOut: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  }) as unknown as ReturnType<typeof useAuth>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useAuth).mockReturnValue(mockAuthValue());
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

  it("redirects to contact email for null tierId (Enterprise)", async () => {
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan(null);
    });
    expect(assignMock).toHaveBeenCalledWith(
      "mailto:admin@evans-software-solutions.com",
    );
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("free tier, unauthed user → redirects to /signup", async () => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuthValue({ isAuthenticated: false }),
    );
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("free");
    });
    expect(assignMock).toHaveBeenCalledWith("/signup");
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(provisionFreeSilently).not.toHaveBeenCalled();
  });

  it("free tier, authed user → provisions and redirects to /dashboard (no /signup loop)", async () => {
    // Closes the loop where an already-signed-in user clicked Free on the
    // Subscribe page and was bounced back to /signup.
    vi.mocked(useAuth).mockReturnValue(
      mockAuthValue({ isAuthenticated: true }),
    );
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("free");
    });
    expect(provisionFreeSilently).toHaveBeenCalledOnce();
    expect(assignMock).toHaveBeenCalledWith("/dashboard");
    expect(assignMock).not.toHaveBeenCalledWith("/signup");
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("calls createCheckoutSession and redirects on premium success", async () => {
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("premium");
    });
    expect(createCheckoutSession).toHaveBeenCalledWith("premium");
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
      await result.current.handleSelectPlan("premium");
    });
    expect(result.current.loadingTier).toBeNull();
    expect(result.current.error).toBe("Stripe unavailable");
  });

  it("uses fallback error message for non-Error throws", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce("unexpected");
    const { result } = renderHook(() => useCheckoutSelection());
    await act(async () => {
      await result.current.handleSelectPlan("premium");
    });
    expect(result.current.error).toBe("Failed to start checkout");
  });

  it("clears previous error before a new Premium attempt", async () => {
    vi.mocked(createCheckoutSession)
      .mockRejectedValueOnce(new Error("first error"))
      .mockResolvedValueOnce({ url: "https://checkout.stripe.com/pay/cs_ok" });

    const { result } = renderHook(() => useCheckoutSelection());

    await act(async () => {
      await result.current.handleSelectPlan("premium");
    });
    expect(result.current.error).toBe("first error");

    await act(async () => {
      await result.current.handleSelectPlan("premium");
    });
    expect(result.current.error).toBeNull();
  });
});
