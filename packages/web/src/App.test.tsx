import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "./App";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";

describe("App", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      onboardingCompleted: false,
      user: null,
      session: null,
      error: null,
      signIn: vi.fn().mockResolvedValue({ success: true }),
      signUp: vi.fn().mockResolvedValue({ success: true }),
      signOut: vi.fn().mockResolvedValue({ success: true }),
      completeOnboarding: vi.fn().mockResolvedValue({ success: true }),
    });
  });

  it("redirects unauthenticated user to login", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      onboardingCompleted: false,
      user: null,
      session: null,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Welcome back")).toBeDefined();
  });

  it("redirects to login when unauthenticated user visits protected route", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      onboardingCompleted: false,
      user: null,
      session: null,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/subscribe"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Welcome back")).toBeDefined();
  });

  it("shows loading when auth is loading", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      onboardingCompleted: false,
      user: null,
      session: null,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("redirects authenticated user without onboarding to chat (onboarding)", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      onboardingCompleted: false,
      user: { id: "1", email: "a@b.com" },
      session: {} as never,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    // Should redirect to /dashboard/chat where onboarding happens
    expect(screen.getByText(/welcome to axel/i)).toBeDefined();
  });

  it("redirects authenticated user with onboarding to dashboard", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      onboardingCompleted: true,
      user: { id: "1", email: "a@b.com" },
      session: {} as never,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Office")[0]).toBeDefined();
  });

  it("allows authenticated user to access protected route /subscribe", () => {
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      onboardingCompleted: true,
      user: { id: "1", email: "a@b.com" },
      session: {} as never,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      completeOnboarding: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/subscribe"]}>
        <App />
      </MemoryRouter>,
    );
    // Protected route should work for authenticated user - should not redirect to login
    // Instead of checking for specific text, just verify the page loaded without redirect
    // The ProtectedRoute should render its children (Subscribe) not redirect
    const html = document.body.innerHTML;
    expect(html).toContain("Choose"); // Subscribe page has "Choose your plan"
  });
});
