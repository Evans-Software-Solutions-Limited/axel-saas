import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SignUp } from "../SignUp";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockFreePost = vi.fn().mockResolvedValue({ data: { success: true } });
vi.mock("@/lib/eden", () => ({
  api: {
    core: {
      subscriptions: {
        free: { post: (...args: unknown[]) => mockFreePost(...args) },
      },
    },
  },
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
    mockFreePost.mockReset();
    mockFreePost.mockResolvedValue({ data: { success: true } });
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
    expect(mockFreePost).toHaveBeenCalledOnce();
  });

  it("logs and continues when /free returns an HTTP error (Eden response.error path)", async () => {
    // Simulates the email-confirmation flow: signUp resolves but the session
    // isn't ready yet, so /free returns 401. Eden treaty resolves with
    // `{ data, error }` rather than throwing — the page must inspect
    // response.error explicitly, log a warning, and still navigate.
    const signUp = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    mockFreePost.mockResolvedValueOnce({
      data: null,
      error: { status: 401, value: { error: "Unauthorized" } },
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

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

    expect(mockFreePost).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      "[signup] free-tier provisioning deferred:",
      expect.objectContaining({ status: 401 }),
    );
    expect(screen.queryByText(/error occurred/i)).toBeNull();
    warnSpy.mockRestore();
  });

  it("logs and continues when /free throws (network failure path)", async () => {
    // Defensive: covers genuine throws (DNS, fetch reject) that bypass Eden's
    // normal { data, error } resolution. Same outcome — warn, navigate on.
    const signUp = vi.fn().mockResolvedValue({ success: true });
    vi.mocked(useAuth).mockReturnValue(mockAuth({ signUp }));
    mockFreePost.mockRejectedValueOnce(new Error("Network down"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

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

    expect(mockFreePost).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalled();
    expect(screen.queryByText(/error occurred/i)).toBeNull();
    warnSpy.mockRestore();
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
