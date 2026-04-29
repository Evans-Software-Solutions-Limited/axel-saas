import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MarketingLayout } from "../MarketingLayout";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderAt(path: string, children = <p>page content</p>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <MarketingLayout>{children}</MarketingLayout>
    </MemoryRouter>,
  );
}

describe("MarketingLayout", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders children", () => {
    renderAt("/");
    expect(screen.getByText("page content")).toBeDefined();
  });

  it("renders Axel logo link", () => {
    renderAt("/");
    const logoLinks = screen.getAllByRole("link", { name: /axel/i });
    expect(logoLinks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders nav links in correct order: Home, Use Cases, Pricing, About, Sign in, Join waitlist", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const links = nav.querySelectorAll("a");
    const labels = Array.from(links).map((l) => l.textContent?.trim());
    expect(labels).toEqual([
      "Home",
      "Use Cases",
      "Pricing",
      "About",
      "Sign in",
      "Join waitlist",
    ]);
  });

  it("nav Join waitlist links to waitlist form on home", () => {
    renderAt("/");
    const waitlistLinks = screen.getAllByRole("link", {
      name: /join waitlist/i,
    });
    expect(
      waitlistLinks.some(
        (l) => l.getAttribute("href") === waitlistSignupHref(),
      ),
    ).toBe(true);
  });

  it("Home nav link has active styling when path is /", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const homeLink = Array.from(nav.querySelectorAll("a")).find(
      (l) => l.textContent?.trim() === "Home",
    )!;
    expect(homeLink.className).toContain("font-medium");
  });

  it("non-active nav links do not have active styling", () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const useCasesLink = Array.from(nav.querySelectorAll("a")).find(
      (l) => l.textContent?.trim() === "Use Cases",
    )!;
    expect(useCasesLink.className).not.toContain("font-medium");
  });

  it("Pricing nav link has active styling when path is /pricing", () => {
    renderAt("/pricing");
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const pricingLink = Array.from(nav.querySelectorAll("a")).find(
      (l) => l.textContent?.trim() === "Pricing",
    )!;
    expect(pricingLink.className).toContain("font-medium");
  });

  it("renders footer with Privacy Policy, Terms of Service, and Contact links", () => {
    renderAt("/");
    expect(screen.getByRole("link", { name: /privacy policy/i })).toBeDefined();
    expect(
      screen.getByRole("link", { name: /terms of service/i }),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: /contact/i })).toBeDefined();
  });

  it("footer Privacy Policy links to /privacy", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: /privacy policy/i });
    expect(link.getAttribute("href")).toBe("/privacy");
  });

  it("footer Terms of Service links to /terms", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: /terms of service/i });
    expect(link.getAttribute("href")).toBe("/terms");
  });

  it("footer Contact links to mailto:admin@evans-software-solutions.com", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: /contact/i });
    expect(link.getAttribute("href")).toBe(
      "mailto:admin@evans-software-solutions.com",
    );
  });

  it("renders OpenClaw attribution link", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: /^openclaw$/i });
    expect(link.getAttribute("href")).toBe("https://openclaw.dev");
  });

  it("renders copyright notice", () => {
    renderAt("/");
    expect(screen.getByText(/axel\. all rights reserved/i)).toBeDefined();
  });

  it("renders data trust line", () => {
    renderAt("/");
    expect(
      screen.getByText(/don.t train on your conversations/i),
    ).toBeDefined();
  });
});
