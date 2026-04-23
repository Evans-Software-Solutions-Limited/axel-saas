import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Subscribe } from "../Subscribe";
import { createCheckoutSession } from "../subscribeApi";
import * as planRecommendation from "../planRecommendation";

vi.mock("../subscribeApi", () => ({
  createCheckoutSession: vi
    .fn()
    .mockResolvedValue({ url: "https://checkout.stripe.com/pay/cs_test" }),
}));

describe("Subscribe", () => {
  it("renders the three pricing plans", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText("Free")).toBeDefined();
    expect(screen.getByText("Premium")).toBeDefined();
    expect(screen.getByText("Enterprise")).toBeDefined();
  });

  it("renders plan prices", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText(/£0/)).toBeDefined();
    expect(screen.getByText(/£49/)).toBeDefined();
    expect(screen.getByText("Contact us")).toBeDefined();
  });

  it("does not show a recommendation badge when no signals are available", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.queryByText("Best starting point")).toBeNull();
    expect(screen.queryByText(/based on your needs/i)).toBeNull();
  });

  it("renders Get started for self-serve plans", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    const getStartedButtons = screen.getAllByRole("button", {
      name: "Get started",
    });
    // Free + Premium = 2 self-serve plans
    expect(getStartedButtons.length).toBe(2);
  });

  it("Enterprise plan shows Contact sales button", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Contact sales" })).toBeDefined();
  });

  it("Contact sales button is clickable without error", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Contact sales" })),
    ).not.toThrow();
  });

  it("clicking Get started on the Premium plan calls createCheckoutSession with 'premium'", async () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    // Free is index 0, Premium is index 1 — Premium triggers checkout
    fireEvent.click(screen.getAllByRole("button", { name: "Get started" })[1]);
    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith("premium");
    });
  });

  it("shows error message when createCheckoutSession rejects on Premium", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(
      new Error("Stripe unavailable"),
    );
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    // Premium is the second Get started button
    fireEvent.click(screen.getAllByRole("button", { name: "Get started" })[1]);
    await waitFor(() => {
      expect(screen.getByText("Stripe unavailable")).toBeDefined();
    });
  });

  describe("when a signal-driven recommendation is available", () => {
    it("shows the recommendation badge and reason on the recommended plan", () => {
      vi.spyOn(planRecommendation, "getRecommendedPlan").mockReturnValue({
        tierId: "premium",
        reason: "Based on your needs around deeper integrations.",
        shortReason: "Based on your needs",
      });

      render(
        <MemoryRouter>
          <Subscribe />
        </MemoryRouter>,
      );

      expect(screen.getByText("Based on your needs")).toBeDefined();
      expect(
        screen.getByText(/based on your needs around deeper integrations/i),
      ).toBeDefined();

      vi.restoreAllMocks();
    });

    it("renders all three plan buttons when a recommendation is set", () => {
      vi.spyOn(planRecommendation, "getRecommendedPlan").mockReturnValue({
        tierId: "premium",
        reason: "Based on your needs around deeper integrations.",
        shortReason: "Based on your needs",
      });

      render(
        <MemoryRouter>
          <Subscribe />
        </MemoryRouter>,
      );

      const getStartedButtons = screen.getAllByRole("button", {
        name: "Get started",
      });
      expect(getStartedButtons.length).toBe(2);
      expect(
        screen.getByRole("button", { name: "Contact sales" }),
      ).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  it("renders FAQ section", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText("Common questions")).toBeDefined();
    expect(screen.getByText(/can i change my plan later/i)).toBeDefined();
    expect(screen.getAllByText(/free trial/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/payment methods/i).length).toBeGreaterThan(0);
  });
});
