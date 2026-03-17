import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Pricing from "../Pricing";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderPricing() {
  return render(
    <MemoryRouter initialEntries={["/pricing"]}>
      <Pricing />
    </MemoryRouter>,
  );
}

beforeEach(() => {
vi.mocked(useAuth).mockReturnValue({
  isAuthenticated: false,
  signOut: vi.fn(),
} as unknown as ReturnType<typeof useAuth>);
});

describe("Pricing", () => {
  it("renders page heading", () => {
    renderPricing();
    expect(
      screen.getByRole("heading", { name: /simple, transparent pricing/i }),
    ).toBeDefined();
  });

  it("renders free trial notice", () => {
    renderPricing();
    const matches = screen.getAllByText(/14-day free trial/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all plan names", () => {
    renderPricing();
    expect(screen.getByText("Starter")).toBeDefined();
    expect(screen.getByText("Pro")).toBeDefined();
    expect(screen.getByText("Business")).toBeDefined();
    expect(screen.getByText("Developer")).toBeDefined();
    expect(screen.getByText("Enterprise")).toBeDefined();
  });

  it("renders plan prices", () => {
    renderPricing();
    expect(screen.getByText("£19")).toBeDefined();
    expect(screen.getByText("£49")).toBeDefined();
    expect(screen.getByText("£99")).toBeDefined();
    expect(screen.getByText("£149")).toBeDefined();
    expect(screen.getByText("Custom")).toBeDefined();
  });

  it("renders recommended badge on Pro plan", () => {
    renderPricing();
    expect(screen.getByText(/best starting point/i)).toBeDefined();
  });

  it("renders Contact sales for Enterprise plan", () => {
    renderPricing();
    expect(
      screen.getByRole("button", { name: /contact sales/i }),
    ).toBeDefined();
  });

  it("renders Get started buttons for paid plans", () => {
    renderPricing();
    const getStartedButtons = screen.getAllByRole("button", {
      name: /get started/i,
    });
    expect(getStartedButtons.length).toBe(4);
  });

  it("Get started buttons are wrapped in /signup links", () => {
    renderPricing();
    const signupLinks = screen
      .getAllByRole("link")
      .filter((l) => l.getAttribute("href") === "/signup");
    expect(signupLinks.length).toBeGreaterThanOrEqual(4);
  });

  it("renders FAQ section", () => {
    renderPricing();
    expect(
      screen.getByRole("heading", { name: /common questions/i }),
    ).toBeDefined();
    expect(screen.getByText(/can i change my plan later/i)).toBeDefined();
    expect(screen.getByText(/is there a free trial/i)).toBeDefined();
    expect(screen.getByText(/what payment methods/i)).toBeDefined();
  });

  it("Pricing nav link is active when at /pricing", () => {
    renderPricing();
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const pricingLink = Array.from(nav.querySelectorAll("a")).find(
      (l) => l.textContent?.trim() === "Pricing",
    )!;
    expect(pricingLink.className).toContain("font-medium");
  });
});
