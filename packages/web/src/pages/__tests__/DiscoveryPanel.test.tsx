import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DiscoveryPanel } from "../chat/DiscoveryPanel";
import type { Recommendation } from "../planRecommendation";

const recommendation: Recommendation = {
  tierId: "premium",
  reason:
    "Covers calendar, email, and integrations — the features most users need from day one.",
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

  it("renders all three plan tiers", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(screen.getByText("Free")).toBeDefined();
    expect(screen.getByText("Premium")).toBeDefined();
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
      screen.getByText(/covers calendar, email, and integrations/i),
    ).toBeDefined();
  });

  it("calls onSelectPlan with 'free' when the Free plan's Get started is clicked", async () => {
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
    // Free is the first self-serve plan (index 0)
    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(onSelectPlan).toHaveBeenCalledWith("free");
    });
  });

  it("calls onSelectPlan with 'premium' when the Premium plan's Get started is clicked", async () => {
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
    // Premium is the second self-serve plan (index 1)
    fireEvent.click(buttons[1]);
    await waitFor(() => {
      expect(onSelectPlan).toHaveBeenCalledWith("premium");
    });
  });

  it("shows Redirecting... on the loading tier button", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier="premium"
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
        loadingTier="free"
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
    expect(screen.getByText("Premium")).toBeDefined();
  });

  it("does not claim a suggestion in the intro when recommendation is null", () => {
    render(
      <DiscoveryPanel
        recommendation={null}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(screen.queryByText(/i've suggested one below/i)).toBeNull();
    expect(
      screen.getByText(/pick a plan that fits how you work/i),
    ).toBeDefined();
  });

  it("shows the suggestion claim in the intro when a recommendation is present", () => {
    render(
      <DiscoveryPanel
        recommendation={recommendation}
        onSelectPlan={vi.fn()}
        loadingTier={null}
        error={null}
      />,
    );
    expect(screen.getByText(/i've suggested one below/i)).toBeDefined();
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
