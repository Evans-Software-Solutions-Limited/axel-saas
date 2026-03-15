import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Subscribe } from "../Subscribe";
import { createCheckoutSession } from "../subscribeApi";

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

  it("shows recommendation badge with explicit reason on Pro plan", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    // Badge shows a short, meaningful label — never just "Recommended"
    expect(screen.getByText("Best starting point")).toBeDefined();
    // Full reason text is shown below the badge
    expect(
      screen.getByText(/covers calendar, email, and task automation/i),
    ).toBeDefined();
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
