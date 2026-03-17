import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppHeader } from "../AppHeader";
import { useAuth } from "@/hooks/useAuth";

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

  it("renders Login and Sign Up when unauthenticated", () => {
    render(
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>,
    );
    const loginLinks = screen.getAllByRole("link", { name: /^login$/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
    expect(loginLinks[0]!.getAttribute("href")).toBe("/login");
    const signUpLinks = screen.getAllByRole("link", { name: /sign up/i });
    expect(signUpLinks.length).toBeGreaterThanOrEqual(1);
    expect(signUpLinks[0]!.getAttribute("href")).toBe("/signup");
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
