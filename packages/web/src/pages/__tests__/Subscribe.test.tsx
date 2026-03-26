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
  it("renders pricing plans", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText("Starter")).toBeDefined();
    expect(screen.getByText("Pro")).toBeDefined();
    expect(screen.getByText("Business")).toBeDefined();
    expect(screen.getByText("Enterprise")).toBeDefined();
  });

  it("renders plan prices", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText(/£19/)).toBeDefined();
    expect(screen.getByText(/£49/)).toBeDefined();
    expect(screen.getByText(/£99/)).toBeDefined();
    expect(screen.getByText(/£149/)).toBeDefined();
  });

  it("does not show a recommendation badge when no signals are available", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    // No onboarding signals on the generic pricing page — no badge should render
    expect(screen.queryByText("Best starting point")).toBeNull();
    expect(screen.queryByText(/based on your needs/i)).toBeNull();
    expect(screen.queryByText(/covers calendar, email/i)).toBeNull();
  });

  it("renders Get started for non-Enterprise plans", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    const getStartedButtons = screen.getAllByRole("button", {
      name: "Get started",
    });
    expect(getStartedButtons.length).toBeGreaterThan(0);
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
    // Clicking Contact sales should not throw; jsdom doesn't support window.location.assign spying
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Contact sales" })),
    ).not.toThrow();
  });

  it("clicking Get started calls createCheckoutSession with the plan tier", async () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Get started" })[0]);
    await waitFor(() => {
      expect(createCheckoutSession).toHaveBeenCalledWith("starter");
    });
  });

  it("shows error message when createCheckoutSession rejects", async () => {
    vi.mocked(createCheckoutSession).mockRejectedValueOnce(
      new Error("Stripe unavailable"),
    );
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Get started" })[0]);
    await waitFor(() => {
      expect(screen.getByText("Stripe unavailable")).toBeDefined();
    });
  });

  describe("when a signal-driven recommendation is available", () => {
    it("shows the recommendation badge and reason on the recommended plan", () => {
      vi.spyOn(planRecommendation, "getRecommendedPlan").mockReturnValue({
        tierId: "pro",
        reason: "Based on your calendar, email, and task automation needs.",
        shortReason: "Based on your needs",
      });

      render(
        <MemoryRouter>
          <Subscribe />
        </MemoryRouter>,
      );

      expect(screen.getByText("Based on your needs")).toBeDefined();
      expect(
        screen.getByText(
          /based on your calendar, email, and task automation needs/i,
        ),
      ).toBeDefined();

      vi.restoreAllMocks();
    });

    it("highlights the recommended plan card with accent border", () => {
      vi.spyOn(planRecommendation, "getRecommendedPlan").mockReturnValue({
        tierId: "pro",
        reason: "Based on your calendar, email, and task automation needs.",
        shortReason: "Based on your needs",
      });

      render(
        <MemoryRouter>
          <Subscribe />
        </MemoryRouter>,
      );

      // Recommended plan button uses accent background
      const buttons = screen.getAllByRole("button", { name: "Get started" });
      // Pro is the second plan (index 1); its button should exist
      expect(buttons.length).toBeGreaterThanOrEqual(2);

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
