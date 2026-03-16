import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiscoveryPanel } from "../chat/DiscoveryPanel";
import type { Recommendation } from "../planRecommendation";

const recommendation: Recommendation = {
  tierId: "pro",
  reason:
    "Covers calendar, email, and task automation — the features most users need from day one.",
  shortReason: "Best starting point",
};

describe("DiscoveryPanel", () => {
  it("renders Axel's intro message", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(
      screen.getByText(/pick a plan that fits how you work/i),
    ).toBeDefined();
  });

  it("renders all plan tiers", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(screen.getByText("Starter")).toBeDefined();
    expect(screen.getByText("Pro")).toBeDefined();
    expect(screen.getByText("Business")).toBeDefined();
    expect(screen.getByText("Developer")).toBeDefined();
    expect(screen.getByText("Enterprise")).toBeDefined();
  });

  it("shows the recommendation badge with shortReason on the recommended plan", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(screen.getByText("Best starting point")).toBeDefined();
  });

  it("shows the full recommendation reason below the badge", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(
      screen.getByText(/covers calendar, email, and task automation/i),
    ).toBeDefined();
  });

  it("calls onSelectPlan with the tierId when Get started is clicked", async () => {
    const onSelectPlan = vi.fn();
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={onSelectPlan}
        loadingTier={null}
        error={null}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: "Get started" });
    // First button is Starter (index 0)
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(onSelectPlan).toHaveBeenCalledWith("starter");
    });
  });

  it("shows Redirecting... on the loading tier button", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier="pro"
        error={null}
      />,
    );
    expect(screen.getByText("Redirecting...")).toBeDefined();
  });

  it("disables all buttons while a tier is loading", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier="starter"
        error={null}
      />,
    );
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("shows error message when error prop is set", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error="Checkout failed"
      />,
    );
    expect(screen.getByText("Checkout failed")).toBeDefined();
  });

  it("does not show Redirecting on Enterprise button when loadingTier is null", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    // Enterprise has tierId: null — its button must never say "Redirecting..."
    expect(screen.queryByText("Redirecting...")).toBeNull();
    expect(screen.getByRole("button", { name: "Contact sales" })).toBeDefined();
  });

  it("does not show a recommendation badge when recommendation is null", () => {
    render(
      <DiscoveryPanel
        recommendation={null}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(screen.queryByText("Best starting point")).toBeNull();
    expect(screen.queryByText(/based on your needs/i)).toBeNull();
    // Plans are still rendered
    expect(screen.getByText("Pro")).toBeDefined();
  });

  it("calls onSelectPlan with null for Enterprise Contact sales", () => {
    const onSelectPlan = vi.fn();
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={onSelectPlan}
        loadingTier={null}
        error={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contact sales" }));
    expect(onSelectPlan).toHaveBeenCalledWith(null);
  });
});
