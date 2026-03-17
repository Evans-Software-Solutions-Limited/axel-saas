import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Home from "../Home";
import { useAuth } from "@/hooks/useAuth";

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
  it("renders hero heading", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: /your 24\/7 ai employee/i }),
    ).toBeDefined();
  });

  it("renders hero subtext", () => {
    renderHome();
    expect(screen.getByText(/email, calendar, tasks/i)).toBeDefined();
  });

  it("renders Get started free CTA linking to /signup", () => {
    renderHome();
    const link = screen.getByRole("link", { name: /get started free/i });
    expect(link.getAttribute("href")).toBe("/signup");
  });

  it("renders See pricing link to /pricing", () => {
    renderHome();
    const link = screen.getByRole("link", { name: /see pricing/i });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("renders free trial notice", () => {
    renderHome();
    expect(screen.getByText(/14-day free trial/i)).toBeDefined();
  });

  it("renders features section heading", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: /everything you need/i }),
    ).toBeDefined();
  });

  it("renders all four feature titles", () => {
    renderHome();
    expect(screen.getByText("Email Triage")).toBeDefined();
    expect(screen.getByText("Calendar Management")).toBeDefined();
    expect(screen.getByText("Task Automation")).toBeDefined();
    expect(screen.getByText("Telegram Integration")).toBeDefined();
  });

  it("renders CTA section with Start for free link", () => {
    renderHome();
    const links = screen.getAllByRole("link", { name: /start for free/i });
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].getAttribute("href")).toBe("/signup");
  });

  it("renders Ready to delegate heading", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { name: /ready to delegate/i }),
    ).toBeDefined();
  });

  it("renders marketing nav with Use Cases link", () => {
    renderHome();
    expect(screen.getByRole("link", { name: /use cases/i })).toBeDefined();
  });
});
