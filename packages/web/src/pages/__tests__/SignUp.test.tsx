import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SignUp } from "../SignUp";

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
  signUp: vi.fn().mockResolvedValue({ success: true }),
  signOut: vi.fn().mockResolvedValue({ success: true }),
  ...overrides,
});

describe("SignUp", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue(
      mockAuth({ signUp: vi.fn().mockResolvedValue({ success: true }) }),
    );
    mockProvisionFreeSilently.mockReset();
    mockProvisionFreeSilently.mockResolvedValue(undefined);
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
    const signUp = vi.fn().mockResolvedValue({ success: true });
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

  it("provisions a free subscription after a successful signup", async () => {
    const signUp = vi.fn().mockResolvedValue({ success: true });
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
});
