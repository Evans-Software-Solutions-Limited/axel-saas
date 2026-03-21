import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Home from "../Home";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Home />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: false,
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
});

describe("Home", () => {
  it("renders hero headline from messaging strategy", () => {
    renderHome();
    expect(
      screen.getByRole("heading", {
        name: /one assistant\. every kind of work/i,
      }),
    ).toBeDefined();
  });

  it("renders release expectation copy", () => {
    renderHome();
    expect(screen.getAllByText(/coming weeks/i).length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("renders Join waitlist CTAs linking to waitlist form on home", () => {
    renderHome();
    const links = screen.getAllByRole("link", { name: /join waitlist/i });
    expect(
      links.some((l) => l.getAttribute("href") === waitlistSignupHref()),
    ).toBe(true);
  });

  it("renders See how it works anchor to #how-it-works", () => {
    renderHome();
    const link = screen.getByRole("link", { name: /see how it works/i });
    expect(link.getAttribute("href")).toBe("#how-it-works");
  });

  it("renders value strip with three headlines", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: /your day, planned/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /every meeting, captured/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /connects to how you work/i }),
    ).toBeDefined();
  });

  it("renders pricing teaser tier names", () => {
    renderHome();
    const teaser = screen.getByRole("heading", {
      name: /simple plans/i,
    }).parentElement;
    expect(teaser?.textContent).toMatch(/Free/);
    expect(teaser?.textContent).toMatch(/Premium/);
    expect(teaser?.textContent).toMatch(/Enterprise/);
  });

  it("renders link to full pricing page", () => {
    renderHome();
    const link = screen.getByRole("link", { name: /see full pricing/i });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("renders waitlist form section", () => {
    renderHome();
    expect(screen.getByLabelText(/^email$/i)).toBeDefined();
    expect(screen.getByLabelText(/interested in/i)).toBeDefined();
  });

  it("renders marketing nav with Use Cases link", () => {
    renderHome();
    expect(screen.getByRole("link", { name: /use cases/i })).toBeDefined();
  });
});
