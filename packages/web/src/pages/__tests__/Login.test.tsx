import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Login } from "../Login";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/useAuth";

const mockAuth = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => ({
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
  ...overrides,
});

describe("Login", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(mockAuth({ error: null }));
  });

  it("renders sign in form and Axel branding", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByText(/axel/i)).toBeDefined();
    expect(screen.getByText(/welcome back/i)).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/password/i)).toBeDefined();
  });

  it("renders link to sign up", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: /create one/i })).toBeDefined();
  });

  it("calls signIn when form is submitted", async () => {
    const signIn = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signIn, error: null }));
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "password123" },
      });
      const submitButton = screen.getByRole("button", { name: /^Sign in$/i });
      fireEvent.submit(submitButton.closest("form")!);
    });
    expect(signIn).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("stays on login when signIn returns success false", async () => {
    const signIn = vi.fn().mockResolvedValue({ success: false });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signIn, error: null }));
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "u@b.com" },
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: "pass" },
      });
      fireEvent.submit(
        screen.getByRole("button", { name: /^Sign in$/i }).closest("form")!,
      );
    });
    expect(screen.getByText(/welcome back/i)).toBeDefined();
  });
});
