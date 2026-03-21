import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppHeader } from "../AppHeader";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

describe("AppHeader", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
  });

  it("renders logo linking to home", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const logo = screen.getByRole("link", { name: /axel/i });
    expect(logo.getAttribute("href")).toBe("/");
  });

  it("renders Join waitlist when unauthenticated", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const waitlistLinks = screen.getAllByRole("link", {
      name: /join waitlist/i,
    });
    expect(waitlistLinks.length).toBeGreaterThanOrEqual(1);
    expect(waitlistLinks[0]!.getAttribute("href")).toBe(waitlistSignupHref());
  });

  it("renders Home nav and Logout when authenticated (no Dashboard link)", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>);
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const homeLinks = screen.getAllByRole("link", { name: /^home$/i });
    expect(homeLinks.length).toBeGreaterThanOrEqual(1);
    expect(homeLinks[0]!.getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: /dashboard/i })).toBeNull();
    const logoutButtons = screen.getAllByRole("button", { name: /logout/i });
    expect(logoutButtons.length).toBeGreaterThanOrEqual(1);
  });
});
