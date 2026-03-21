import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Pricing from "../Pricing";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

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
    expect(screen.getByRole("heading", { name: /^pricing$/i })).toBeDefined();
  });

  it("renders public tier names", () => {
    renderPricing();
    expect(screen.getByText(/^Free$/)).toBeDefined();
    expect(screen.getByText(/^Premium$/)).toBeDefined();
    expect(screen.getByText(/^Enterprise$/)).toBeDefined();
  });

  it("renders Free at $0 and Premium as TBD", () => {
    renderPricing();
    expect(screen.getByText("$0")).toBeDefined();
    expect(screen.getByText("TBD")).toBeDefined();
  });

  it("renders Talk to us for Enterprise linking to mailto", () => {
    renderPricing();
    const link = screen.getByRole("link", { name: /talk to us/i });
    expect(link.getAttribute("href")).toBe(
      "mailto:admin@evans-software-soltuions.com",
    );
  });

  it("renders Join waitlist buttons linking to home waitlist with tier", () => {
    renderPricing();
    const tierLinks = screen
      .getAllByRole("link")
      .filter(
        (l) =>
          l.getAttribute("href") === waitlistSignupHref("free") ||
          l.getAttribute("href") === waitlistSignupHref("pro"),
      );
    expect(tierLinks.length).toBeGreaterThanOrEqual(2);
  });

  it("renders hosted deployments section", () => {
    renderPricing();
    expect(
      screen.getByRole("heading", { name: /hosted deployments/i }),
    ).toBeDefined();
  });

  it("renders FAQ on free limits and cancellation", () => {
    renderPricing();
    expect(
      screen.getByRole("heading", { name: /what are the free tier limits/i }),
    ).toBeDefined();
    expect(screen.getByText(/cancel any time/i)).toBeDefined();
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
