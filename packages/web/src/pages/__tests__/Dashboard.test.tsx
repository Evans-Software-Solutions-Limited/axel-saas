import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router";
import { Dashboard } from "../Dashboard";

// Mock useAuth hook
const mockUseAuth = vi.fn(() => ({
  onboardingCompleted: true,
  isAuthenticated: true,
  isLoading: false,
  user: { id: "1", email: "test@test.com" },
  session: {} as never,
  error: null,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

function MockOutlet() {
  return <div data-testid="outlet">Office content</div>;
}

describe("Dashboard", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      onboardingCompleted: true,
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", email: "test@test.com" },
      session: {} as never,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    });
  });

  it("renders sidebar with Office nav item", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route path="office" element={<MockOutlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Office")[0]).toBeDefined();
    expect(screen.getByTestId("outlet")).toBeDefined();
  });

  it("renders current nav label in header", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route path="office" element={<MockOutlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /office/i })).toBeDefined();
  });

  it("navigates when nav item is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route path="office" element={<MockOutlet />} />
            <Route path="chat" element={<div data-testid="chat">Chat</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const chatButton = screen.getByRole("button", { name: /chat/i });
    fireEvent.click(chatButton);
    expect(screen.getByTestId("chat")).toBeDefined();
  });

  it("toggles sidebar when menu button is clicked", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route path="office" element={<MockOutlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuButton = screen.getByRole("button", { name: "" });
    const aside = document.querySelector("aside");
    expect(aside).toBeDefined();
    fireEvent.click(menuButton);
    expect(aside?.className).toContain("w-20");
  });

  it("calls signOut when logout is clicked", () => {
    const signOutMock = vi.fn().mockResolvedValue({ success: true });
    mockUseAuth.mockReturnValue({
      onboardingCompleted: true,
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", email: "test@test.com" },
      session: {} as never,
      error: null,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: signOutMock,
    });
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route path="office" element={<MockOutlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const logoutButtons = screen
      .getAllByRole("button")
      .filter((b) => b.textContent?.includes("Logout"));
    fireEvent.click(logoutButtons[0]!);
    expect(signOutMock).toHaveBeenCalled();
  });

  it("renders legal page links in sidebar footer when expanded", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/office"]}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />}>
            <Route path="office" element={<MockOutlet />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    // Sidebar is expanded by default, should show Privacy and Terms links
    expect(screen.getByRole("link", { name: /privacy/i })).toBeDefined();
    expect(screen.getByRole("link", { name: /terms/i })).toBeDefined();
    expect(
      screen.getByRole("link", { name: /privacy/i }).getAttribute("href"),
    ).toBe("/privacy");
    expect(
      screen.getByRole("link", { name: /terms/i }).getAttribute("href"),
    ).toBe("/terms");
  });

  it("redirects to chat when onboarding not completed and navigating to other page", () => {
    mockUseAuth.mockReturnValue({
      onboardingCompleted: false,
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", email: "test@test.com" },
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
            <Route path="office" element={<MockOutlet />} />
            <Route path="chat" element={<div data-testid="chat">Chat</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    // Should have redirected to /dashboard/chat
    expect(screen.getByTestId("chat")).toBeDefined();
  });

  it("navigates to chat when clicking locked nav item while onboarding incomplete", () => {
    mockUseAuth.mockReturnValue({
      onboardingCompleted: false,
      isAuthenticated: true,
      isLoading: false,
      user: { id: "1", email: "test@test.com" },
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
            <Route path="office" element={<MockOutlet />} />
            <Route path="chat" element={<div data-testid="chat">Chat</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    // Click on Office nav item (which should be locked since onboarding incomplete)
    const officeButton = screen.getByRole("button", { name: /office/i });
    fireEvent.click(officeButton);

    // Should navigate to chat instead of office
    expect(screen.getByTestId("chat")).toBeDefined();
  });
});
