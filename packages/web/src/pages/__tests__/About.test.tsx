import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import About from "../About";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderAbout() {
  return render(
    <MemoryRouter initialEntries={["/about"]}>
      <About />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
});

describe("About", () => {
  it("renders page heading", () => {
    renderAbout();
    expect(
      screen.getByRole("heading", { name: /why axel exists/i }),
    ).toBeDefined();
  });

  it("renders narrative sections including landscape and hosted", () => {
    renderAbout();
    expect(screen.getByRole("heading", { name: /the problem/i })).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /a crowded landscape/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /personal assistant first/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", {
        name: /integrations, not a public api product/i,
      }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /where axel comes from/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /hosted solutions/i }),
    ).toBeDefined();
    expect(screen.getByText(/tool sprawl/i)).toBeDefined();
  });

  it("links to OpenClaw from body copy", () => {
    renderAbout();
    const links = screen.getAllByRole("link", { name: /^openclaw$/i });
    expect(
      links.some((l) => l.getAttribute("href") === "https://openclaw.dev"),
    ).toBe(true);
  });

  it("renders Join waitlist CTA linking to waitlist form on home", () => {
    renderAbout();
    const links = screen.getAllByRole("link", { name: /join waitlist/i });
    expect(
      links.some((l) => l.getAttribute("href") === waitlistSignupHref()),
    ).toBe(true);
  });

  it("renders marketing nav", () => {
    renderAbout();
    expect(
      screen.getByRole("navigation", { name: /main navigation/i }),
    ).toBeDefined();
  });

  it("About nav link is active when at /about", () => {
    renderAbout();
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const aboutLink = Array.from(nav.querySelectorAll("a")).find(
      (l) => l.textContent?.trim() === "About",
    )!;
    expect(aboutLink.className).toContain("font-medium");
  });

  it("renders footer", () => {
    renderAbout();
    expect(screen.getByRole("link", { name: /privacy policy/i })).toBeDefined();
    expect(
      screen.getByRole("link", { name: /terms of service/i }),
    ).toBeDefined();
  });
});
