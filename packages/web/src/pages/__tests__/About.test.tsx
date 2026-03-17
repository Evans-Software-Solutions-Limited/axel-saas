import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import About from "../About";
import { useAuth } from "@/hooks/useAuth";

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
    expect(screen.getByRole("heading", { name: /about axel/i })).toBeDefined();
  });

  it("renders mission section", () => {
    renderAbout();
    expect(screen.getByRole("heading", { name: /our mission/i })).toBeDefined();
    expect(screen.getByText(/coordination layer/i)).toBeDefined();
  });

  it("renders what makes axel different section", () => {
    renderAbout();
    expect(
      screen.getByRole("heading", { name: /what makes axel different/i }),
    ).toBeDefined();
  });

  it("renders built for real work section", () => {
    renderAbout();
    expect(
      screen.getByRole("heading", { name: /built for real work/i }),
    ).toBeDefined();
  });

  it("renders get in touch section with email link", () => {
    renderAbout();
    expect(
      screen.getByRole("heading", { name: /get in touch/i }),
    ).toBeDefined();
    const emailLink = screen.getByRole("link", { name: /hello@axel.ai/i });
    expect(emailLink.getAttribute("href")).toBe("mailto:hello@axel.ai");
  });

  it("renders Start for free CTA linking to /signup", () => {
    renderAbout();
    const link = screen.getByRole("link", { name: /start for free/i });
    expect(link.getAttribute("href")).toBe("/signup");
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
