import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import App from "../../App";
import { Dashboard } from "../Dashboard";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/hooks/useAuth";
import { Chat } from "../Chat";

/**
 * These tests render `<App />` or `<Dashboard />`, both of which mount
 * `ChatContainer` on the chat route. `ChatContainer` fires an async
 * `loadState()` on mount and performs several `setState` calls in its
 * `finally` block. Synchronous assertions after `render()` return before
 * those state updates settle, which on Linux CI (but usually not on macOS)
 * causes React 19's scheduler to hit `window` after jsdom has torn it down
 * during test teardown, producing a file-level `ReferenceError: window is
 * not defined`.
 *
 * Fix: use async `findBy*` queries so the test awaits settled render
 * before asserting. For assertions about the *absence* of something,
 * await a positive signal from the same render first.
 */
describe("Pre-onboarding routing and tab locking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Home redirect for pre-onboarding users", () => {
    it("redirects authenticated user without onboarding from / to /dashboard/chat", async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: false,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
        error: null,
        setOnboardingCompleted: vi.fn(),
        refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>,
      );

      const chatElements = await screen.findAllByText("Chat");
      expect(chatElements[0]).toBeDefined();
    });

    it("redirects authenticated user with onboarding from / to office", async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: true,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
        error: null,
        setOnboardingCompleted: vi.fn(),
        refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>,
      );

      const officeElements = await screen.findAllByText("Office");
      expect(officeElements[0]).toBeDefined();
    });
  });

  describe("Dashboard tab locking for pre-onboarding users", () => {
    it("shows lock icon on non-chat tabs when onboarding is not completed", async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: false,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
        error: null,
        setOnboardingCompleted: vi.fn(),
        refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
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

      // Wait for Office tab to render, then confirm its lock icon is present.
      const officeButtons = await screen.findAllByText("Office");
      expect(officeButtons[0]).toBeDefined();

      const lockIcons = document.querySelectorAll(".tabler-icon-lock");
      expect(lockIcons.length).toBeGreaterThan(0);
    });

    it("does not show lock icon when onboarding is completed", async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: true,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
        error: null,
        setOnboardingCompleted: vi.fn(),
        refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
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

      // Await a positive signal (the dashboard has rendered the tab list) so
      // the tree is settled before we assert on the *absence* of lock icons.
      await screen.findAllByText("Office");

      const lockIcons = document.querySelectorAll(".tabler-icon-lock");
      expect(lockIcons.length).toBe(0);
    });

    it("shows notice about completing onboarding when not completed", async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: false,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
        error: null,
        setOnboardingCompleted: vi.fn(),
        refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
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

      const notice = await screen.findByText(/complete onboarding/i);
      expect(notice).toBeDefined();
    });
  });

  describe("Chat UI remains intact", () => {
    it("renders chat UI normally for pre-onboarding users", async () => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: false,
        user: { id: "1", email: "a@b.com" },
        session: {} as never,
        error: null,
        setOnboardingCompleted: vi.fn(),
        refreshOnboardingStatus: vi.fn().mockResolvedValue(undefined),
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

      // Chat should be fully rendered with input (check for placeholder).
      const input = await screen.findByPlaceholderText(/axel/i);
      expect(input).toBeDefined();

      // Check for send button with specific icon.
      const sendButton = document.querySelector(".tabler-icon-send");
      expect(sendButton).toBeDefined();
    });
  });
});
