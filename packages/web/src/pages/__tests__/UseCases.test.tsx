import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import UseCases from "../UseCases";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

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

  it("renders four persona sections from messaging strategy", () => {
    renderUseCases();
    expect(
      screen.getByRole("heading", { name: /the knowledge worker/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /the operator \/ team lead/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /the developer/i }),
    ).toBeDefined();
    expect(
      screen.getByRole("heading", { name: /the solopreneur/i }),
    ).toBeDefined();
  });

  it("renders See plans linking to /pricing", () => {
    renderUseCases();
    const link = screen.getByRole("link", { name: /see plans/i });
    expect(link.getAttribute("href")).toBe("/pricing");
  });

  it("renders Join waitlist links to home waitlist with tier where set", () => {
    renderUseCases();
    const hrefs = screen
      .getAllByRole("link", { name: /join waitlist/i })
      .map((l) => l.getAttribute("href"));
    expect(hrefs).toContain(waitlistSignupHref("free"));
    expect(hrefs).toContain(waitlistSignupHref("pro"));
    expect(hrefs).toContain(waitlistSignupHref());
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
