import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import UseCases from "../UseCases";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

function renderUseCases() {
  return render(
    <MemoryRouter initialEntries={["/use-cases"]}>
      <UseCases />
    </MemoryRouter>,
  );
}

beforeEach(() => {
vi.mocked(useAuth).mockReturnValue({
  isAuthenticated: false,
  signOut: vi.fn(),
} as unknown as ReturnType<typeof useAuth>);
});

describe("UseCases", () => {
  it("renders page heading", () => {
    renderUseCases();
    expect(screen.getByRole("heading", { name: /use cases/i })).toBeDefined();
  });

  it("renders subtitle", () => {
    renderUseCases();
    expect(screen.getByText(/adapts to how you work/i)).toBeDefined();
  });

  it("renders all four use case card titles", () => {
    renderUseCases();
    expect(screen.getByText("Busy Professionals")).toBeDefined();
    expect(screen.getByText("Founders & Solopreneurs")).toBeDefined();
    expect(screen.getByText("Remote Teams")).toBeDefined();
    expect(screen.getByText("Technical Teams")).toBeDefined();
  });

  it("renders highlights for Busy Professionals", () => {
    renderUseCases();
    expect(screen.getByText("Inbox zero by 9am")).toBeDefined();
    expect(screen.getByText("Daily summary brief")).toBeDefined();
    expect(screen.getByText("Conflict-free scheduling")).toBeDefined();
  });

  it("renders highlights for Technical Teams", () => {
    renderUseCases();
    expect(screen.getByText("Full API access")).toBeDefined();
    expect(screen.getByText("Code generation")).toBeDefined();
    expect(screen.getByText("Custom integrations")).toBeDefined();
  });

  it("renders CTA link to /signup", () => {
    renderUseCases();
    const link = screen.getByRole("link", { name: /try axel for free/i });
    expect(link.getAttribute("href")).toBe("/signup");
  });

  it("renders marketing nav", () => {
    renderUseCases();
    expect(
      screen.getByRole("navigation", { name: /main navigation/i }),
    ).toBeDefined();
  });

  it("Use Cases nav link is active when at /use-cases", () => {
    renderUseCases();
    const nav = screen.getByRole("navigation", { name: /main navigation/i });
    const useCasesLink = Array.from(nav.querySelectorAll("a")).find(
      (l) => l.textContent?.trim() === "Use Cases",
    )!;
    expect(useCasesLink.className).toContain("font-medium");
  });
});
