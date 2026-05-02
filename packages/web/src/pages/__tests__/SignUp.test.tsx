import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SignUp } from "../SignUp";

const mockNavigate = vi.fn();
vi.mock("react-router", async () => {
  const actual =
    await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockProvisionFreeSilently = vi.fn().mockResolvedValue(undefined);
vi.mock("../subscribeApi", () => ({
  provisionFreeSilently: (...args: unknown[]) =>
    mockProvisionFreeSilently(...args),
}));

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
  // Default: session-immediately path (email confirmation disabled or
  // already-verified). Tests for the "check your email" view override
  // signUp explicitly with requiresEmailConfirmation: true.
  signUp: vi
    .fn()
    .mockResolvedValue({ success: true, requiresEmailConfirmation: false }),
  signOut: vi.fn().mockResolvedValue({ success: true }),
  ...overrides,
});

describe("SignUp", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuth({
        signUp: vi.fn().mockResolvedValue({
          success: true,
          requiresEmailConfirmation: false,
        }),
      }),
    );
    mockProvisionFreeSilently.mockReset();
    mockProvisionFreeSilently.mockResolvedValue(undefined);
    mockNavigate.mockReset();
  });

  it("renders sign up form and Axel branding", () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/axel/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/^password$/i)).toBeDefined();
  });

  it("renders Sign in link to /login for returning users", () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    // Two "Sign in" links may render: one in the marketing header (added in
    // the same pass) and one in the page body. Both should point to /login.
    const signInLinks = screen.getAllByRole("link", { name: /^sign in$/i });
    expect(signInLinks.length).toBeGreaterThanOrEqual(1);
    expect(signInLinks.every((l) => l.getAttribute("href") === "/login")).toBe(
      true,
    );
  });

  it("shows error when passwords do not match", () => {
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "password123" },
    });
    const confirmInputs = screen.getAllByLabelText(/password/i);
    const confirm = confirmInputs[confirmInputs.length - 1];
    if (confirm) {
      fireEvent.change(confirm, { target: { value: "different" } });
    }
    fireEvent.submit(
      screen.getByRole("button", { name: /create account|sign up/i }),
    );
    expect(screen.getByText(/passwords do not match/i)).toBeDefined();
  });

  it("calls signUp when form is submitted with matching passwords", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ success: true, requiresEmailConfirmation: false });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await act(async () => {
      const nameInput = screen.getByLabelText(/name/i);
      if (nameInput)
        fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: "password123" },
      });
      const confirmInputs = screen.getAllByLabelText(/password/i);
      const confirm = confirmInputs[confirmInputs.length - 1];
      if (confirm)
        fireEvent.change(confirm, { target: { value: "password123" } });
      const form = screen
        .getByRole("button", { name: /create account|sign up/i })
        .closest("form");
      if (form) fireEvent.submit(form);
    });
    expect(signUp).toHaveBeenCalledWith("test@example.com", "password123");
  });

  it("shows error when signUp returns success false", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ success: false, error: "Email already in use" });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await act(async () => {
      const nameInput = screen.getByLabelText(/name/i);
      if (nameInput)
        fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: "password123" },
      });
      const confirmInputs = screen.getAllByLabelText(/password/i);
      const confirm = confirmInputs[confirmInputs.length - 1];
      if (confirm)
        fireEvent.change(confirm, { target: { value: "password123" } });
      const form = screen
        .getByRole("button", { name: /create account|sign up/i })
        .closest("form");
      if (form) fireEvent.submit(form);
    });
    expect(
      screen.getByText(/email already in use|failed to create account/i),
    ).toBeDefined();
  });

  it("provisions a free subscription after a successful signup with immediate session", async () => {
    const signUp = vi
      .fn()
      .mockResolvedValue({ success: true, requiresEmailConfirmation: false });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await act(async () => {
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: "password123" },
      });
      const confirmInputs = screen.getAllByLabelText(/password/i);
      const confirm = confirmInputs[confirmInputs.length - 1];
      if (confirm)
        fireEvent.change(confirm, { target: { value: "password123" } });
      const form = screen
        .getByRole("button", { name: /create account|sign up/i })
        .closest("form");
      if (form) fireEvent.submit(form);
    });
    expect(mockProvisionFreeSilently).toHaveBeenCalledOnce();
  });

  it("shows error when signUp throws", async () => {
    const signUp = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await act(async () => {
      const nameInput = screen.getByLabelText(/name/i);
      if (nameInput)
        fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "test@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: "password123" },
      });
      const confirmInputs = screen.getAllByLabelText(/password/i);
      const confirm = confirmInputs[confirmInputs.length - 1];
      if (confirm)
        fireEvent.change(confirm, { target: { value: "password123" } });
      const form = screen
        .getByRole("button", { name: /create account|sign up/i })
        .closest("form");
      if (form) fireEvent.submit(form);
    });
    expect(screen.getByText(/error occurred|please try again/i)).toBeDefined();
  });

  // Helper for the verify-email branch — submits the form, asserts the
  // success state took over, and returns the matching email node so callers
  // can drill into it.
  type SignUpFn = ReturnType<typeof useAuth>["signUp"];
  const submitVerifyEmailFlow = async (signUp: SignUpFn) => {
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    render(
      <MemoryRouter>
        <SignUp />
      </MemoryRouter>,
    );
    await act(async () => {
      const nameInput = screen.getByLabelText(/name/i);
      if (nameInput)
        fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "verify-me@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/^password/i), {
        target: { value: "password123" },
      });
      const confirmInputs = screen.getAllByLabelText(/password/i);
      const confirm = confirmInputs[confirmInputs.length - 1];
      if (confirm)
        fireEvent.change(confirm, { target: { value: "password123" } });
      const form = screen
        .getByRole("button", { name: /create account|sign up/i })
        .closest("form");
      if (form) fireEvent.submit(form);
    });
  };

  describe("when signUp succeeds but requires email confirmation", () => {
    it("renders the check-your-email view with the user's email", async () => {
      const signUp = vi
        .fn()
        .mockResolvedValue({ success: true, requiresEmailConfirmation: true });
      await submitVerifyEmailFlow(signUp);

      // Heading flips from "Create an account" to "Check your email".
      expect(screen.getByText(/check your email/i)).toBeDefined();
      expect(screen.getByText("verify-me@example.com")).toBeDefined();
      expect(
        screen.queryByRole("button", { name: /create account/i }),
      ).toBeNull();
    });

    it("does not call provisionFreeSilently (would 401 without a session)", async () => {
      const signUp = vi
        .fn()
        .mockResolvedValue({ success: true, requiresEmailConfirmation: true });
      await submitVerifyEmailFlow(signUp);
      expect(mockProvisionFreeSilently).not.toHaveBeenCalled();
    });

    it("does not navigate to /subscribe", async () => {
      const signUp = vi
        .fn()
        .mockResolvedValue({ success: true, requiresEmailConfirmation: true });
      await submitVerifyEmailFlow(signUp);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("offers a Sign-in link for users who already verified", async () => {
      const signUp = vi
        .fn()
        .mockResolvedValue({ success: true, requiresEmailConfirmation: true });
      await submitVerifyEmailFlow(signUp);
      const signInLinks = screen.getAllByRole("link", { name: /sign in/i });
      expect(signInLinks.some((l) => l.getAttribute("href") === "/login")).toBe(
        true,
      );
    });

    it("'try a different address' returns to the form", async () => {
      const signUp = vi
        .fn()
        .mockResolvedValue({ success: true, requiresEmailConfirmation: true });
      await submitVerifyEmailFlow(signUp);

      fireEvent.click(
        screen.getByRole("button", { name: /try a different address/i }),
      );

      // Form is back; success state is gone.
      expect(
        screen.getByRole("button", { name: /create account/i }),
      ).toBeDefined();
      expect(screen.queryByText(/check your email/i)).toBeNull();
    });
  });
});
