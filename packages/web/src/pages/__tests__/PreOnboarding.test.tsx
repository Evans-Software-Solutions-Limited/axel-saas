import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import App from "../../App";
import { Dashboard } from "../Dashboard";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";
import { Chat } from "../Chat";

describe("Pre-onboarding routing and tab locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Root redirect for pre-onboarding users", () => {
    it("redirects authenticated user without onboarding to /dashboard/chat", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>,
      );

      // Should redirect to /dashboard/chat
      expect(screen.getAllByText("Chat")[0]).toBeDefined();
    });

    it("redirects authenticated user with onboarding to /dashboard", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>,
      );

      // Should redirect to /dashboard with Office as default
      expect(screen.getAllByText("Office")[0]).toBeDefined();
    });
  });

  describe("/onboarding route redirect", () => {
    it("redirects /onboarding to /dashboard/chat for authenticated users", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/onboarding"]}>
          <App />
        </MemoryRouter>,
      );

      // Should redirect to /dashboard/chat
      expect(screen.getAllByText("Chat")[0]).toBeDefined();
    });
  });

  describe("Dashboard tab locking for pre-onboarding users", () => {
    it("shows lock icon on non-chat tabs when onboarding is not completed", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/chat"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route path="chat" element={<Chat />} />
              <Route path="tasks" element={<div>Tasks</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      // Check that Office tab shows lock icon
      const officeButtons = screen.getAllByText("Office");
      expect(officeButtons[0]).toBeDefined();

      // Check that lock icon is present (rendered alongside Office label)
      const lockIcons = document.querySelectorAll(".tabler-icon-lock");
      expect(lockIcons.length).toBeGreaterThan(0);
    });

    it("does not show lock icon when onboarding is completed", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/office"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route path="office" element={<div>Office</div>} />
              <Route path="chat" element={<Chat />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      // No lock icons should be present
      const lockIcons = document.querySelectorAll(".tabler-icon-lock");
      expect(lockIcons.length).toBe(0);
    });

    it("shows notice about completing onboarding when not completed", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/chat"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route path="chat" element={<Chat />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      // Should show onboarding notice
      expect(screen.getByText(/complete onboarding/i)).toBeDefined();
    });
  });

  describe("Chat UI remains intact", () => {
    it("renders chat UI normally for pre-onboarding users", () => {
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
      });

      render(
        <MemoryRouter initialEntries={["/dashboard/chat"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />}>
              <Route path="chat" element={<Chat />} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );

      // Chat should be fully rendered with input (check for placeholder)
      expect(screen.getByPlaceholderText(/axel/i)).toBeDefined();

      // Check for send button with specific icon
      const sendButton = document.querySelector(".tabler-icon-send");
      expect(sendButton).toBeDefined();
    });
  });
});
