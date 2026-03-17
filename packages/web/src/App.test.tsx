import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "./App";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";

const mockAuth = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => ({
  isAuthenticated: false,
  isLoading: false,
  onboardingCompleted: false,
  user: null,
  session: null,
  error: null,
  setOnboardingCompleted: vi.fn(),
  refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
  signIn: vi.fn().mockResolvedValue({ success: true }),
  signUp: vi.fn().mockResolvedValue({ success: true }),
  signOut: vi.fn().mockResolvedValue({ success: true }),
  ...overrides,
});

describe("App", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());
  });

  it("shows marketing home page to unauthenticated user at /", () => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: /your 24\/7 ai employee/i }),
    ).toBeDefined();
  });

  it("redirects to login when unauthenticated user visits protected route", () => {
    vi.mocked(useAuth).mockReturnValue(mockAuth());
    render(
      <MemoryRouter initialEntries={["/subscribe"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Welcome back")).toBeDefined();
  });

  it("shows loading when auth is loading", () => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuth({
        isLoading: true,
      }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText(/loading/i)).toBeDefined();
  });

  it("redirects authenticated user without onboarding from / to chat", () => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuth({
        isAuthenticated: true,
        onboardingCompleted: false,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
      }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Chat")[0]).toBeDefined();
  });

  it("redirects authenticated user with onboarding from / to office", () => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuth({
        isAuthenticated: true,
        onboardingCompleted: true,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
      }),
    );
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Office")[0]).toBeDefined();
  });

  it("redirects authenticated users away from /login to home (dashboard)", () => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuth({
        isAuthenticated: true,
        onboardingCompleted: true,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
      }),
    );
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Office")[0]).toBeDefined();
  });
});
