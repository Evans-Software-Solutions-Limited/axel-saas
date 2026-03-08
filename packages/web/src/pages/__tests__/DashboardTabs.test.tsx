import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Chat, Tasks, Crons, Integrations, Settings } from "../DashboardTabs";

// Mock the useAuth hook completely - no AuthProvider needed
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    isLoading: false,
    onboardingCompleted: true,
    user: { id: "1", email: "test@example.com" },
    session: {} as never,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ success: true }),
    completeOnboarding: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

import { useAuth } from "@/hooks/useAuth";

// Helper to wrap component with mocked useAuth
const renderWithMockAuth = (
  ui: React.ReactElement,
  options?: {
    onboardingCompleted?: boolean;
    completeOnboarding?: () => Promise<{ success: boolean; error?: string }>;
  },
) => {
  const mockOnboardingCompleted = options?.onboardingCompleted ?? true;
  const mockCompleteOnboarding =
    options?.completeOnboarding ?? vi.fn().mockResolvedValue({ success: true });

  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: true,
    isLoading: false,
    onboardingCompleted: mockOnboardingCompleted,
    user: { id: "1", email: "test@example.com" },
    session: {} as never,
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ success: true }),
    completeOnboarding: mockCompleteOnboarding,
  });

  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("DashboardTabs", () => {
  describe("Chat", () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        isAuthenticated: true,
        isLoading: false,
        onboardingCompleted: true,
        user: { id: "1", email: "test@example.com" },
        session: {} as never,
        error: null,
        signIn: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        completeOnboarding: vi.fn(),
      });
    });

    it("renders initial message from Axel", () => {
      renderWithMockAuth(<Chat />);
      expect(screen.getByText(/how can i help you today/i)).toBeDefined();
    });

    it("sends message when user types and submits", () => {
      renderWithMockAuth(<Chat />);
      const input = screen.getByPlaceholderText(/tell axel/i);
      fireEvent.change(input, { target: { value: "Hello" } });
      const sendButton = screen.getByRole("button");
      fireEvent.click(sendButton);
      expect(screen.getByText("Hello")).toBeDefined();
    });

    it("sends message when user presses Enter", () => {
      renderWithMockAuth(<Chat />);
      const input = screen.getByPlaceholderText(/tell axel/i);
      fireEvent.change(input, { target: { value: "Enter test" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });
      expect(screen.getByText("Enter test")).toBeDefined();
    });

    it("does not send when input is empty", () => {
      renderWithMockAuth(<Chat />);
      const initialCount = screen.getAllByText(
        /how can i help you today/i,
      ).length;
      const sendButton = screen.getByRole("button");
      fireEvent.click(sendButton);
      expect(screen.getAllByText(/how can i help you today/i).length).toBe(
        initialCount,
      );
    });

    it("shows Axel processing message after send", async () => {
      vi.useFakeTimers();
      renderWithMockAuth(<Chat />);
      const input = screen.getByPlaceholderText(/tell axel/i);
      fireEvent.change(input, { target: { value: "Help me" } });
      fireEvent.click(screen.getByRole("button"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByText("I'm processing your request...")).toBeDefined();
      // Unmount before restoring real timers so the pending setTimeout callback
      // cannot fire against the jsdom window after it is torn down.
      cleanup();
    });

    it("shows onboarding flow when onboarding is not completed", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      expect(screen.getByText(/welcome to axel/i)).toBeDefined();
    });

    it("shows welcome step when onboarding starts", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      expect(screen.getByText(/let's get started/i)).toBeDefined();
    });

    it("can enter name in onboarding name step", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      // Click "Let's get started" to move to name step
      fireEvent.click(
        screen.getByRole("button", { name: /let's get started/i }),
      );
      expect(screen.getByLabelText(/your name/i)).toBeDefined();
    });

    it("can proceed from name step with valid name", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      // Click "Let's get started" to move to name step
      fireEvent.click(
        screen.getByRole("button", { name: /let's get started/i }),
      );
      // Enter name
      fireEvent.change(screen.getByLabelText(/your name/i), {
        target: { value: "John" },
      });
      // Click Continue
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      // Should show role step
      expect(screen.getByText(/what do you do/i)).toBeDefined();
    });

    it("can select help options in onboarding", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      // Click through to help with step
      fireEvent.click(
        screen.getByRole("button", { name: /let's get started/i }),
      );
      fireEvent.change(screen.getByLabelText(/your name/i), {
        target: { value: "John" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.change(screen.getByLabelText(/your role/i), {
        target: { value: "Manager" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      // Should show help options
      expect(screen.getByText(/what should i help you with/i)).toBeDefined();
    });

    it("can select a help option", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      // Click through to help with step
      fireEvent.click(
        screen.getByRole("button", { name: /let's get started/i }),
      );
      fireEvent.change(screen.getByLabelText(/your name/i), {
        target: { value: "John" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.change(screen.getByLabelText(/your role/i), {
        target: { value: "Manager" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      // Click on an option
      fireEvent.click(screen.getByText(/email management/i));
      // Should show check icon or selected state
    });

    it("can select channels in onboarding", () => {
      renderWithMockAuth(<Chat />, { onboardingCompleted: false });
      // Click through to channels step
      fireEvent.click(
        screen.getByRole("button", { name: /let's get started/i }),
      );
      fireEvent.change(screen.getByLabelText(/your name/i), {
        target: { value: "John" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.change(screen.getByLabelText(/your role/i), {
        target: { value: "Manager" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.click(screen.getByText(/email management/i));
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      // Should show channel options
      expect(screen.getByText(/where should i communicate/i)).toBeDefined();
    });

    it("can complete onboarding flow", async () => {
      const completeOnboarding = vi.fn().mockResolvedValue({ success: true });
      renderWithMockAuth(<Chat />, {
        onboardingCompleted: false,
        completeOnboarding,
      });
      // Click through all steps
      fireEvent.click(
        screen.getByRole("button", { name: /let's get started/i }),
      );
      fireEvent.change(screen.getByLabelText(/your name/i), {
        target: { value: "John" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.change(screen.getByLabelText(/your role/i), {
        target: { value: "Manager" },
      });
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.click(screen.getByText(/email management/i));
      fireEvent.click(screen.getByRole("button", { name: /continue/i }));
      fireEvent.click(screen.getByText(/email/i));
      fireEvent.click(screen.getByRole("button", { name: /complete setup/i }));
      // Should call completeOnboarding
      expect(completeOnboarding).toHaveBeenCalled();
    });
  });

  describe("Tasks", () => {
    it("renders task list with filters", () => {
      render(<Tasks />);
      expect(screen.getByPlaceholderText(/search tasks/i)).toBeDefined();
      expect(screen.getByText("Process email inbox")).toBeDefined();
      expect(screen.getByText("Generate weekly report")).toBeDefined();
      expect(screen.getByText("In Progress")).toBeDefined();
      expect(screen.getByText("Completed")).toBeDefined();
    });

    it("filters tasks by search term", () => {
      render(<Tasks />);
      const search = screen.getByPlaceholderText(/search tasks/i);
      fireEvent.change(search, { target: { value: "email" } });
      expect(screen.getByText("Process email inbox")).toBeDefined();
      expect(screen.queryByText("Generate weekly report")).toBeNull();
    });

    it("filters tasks by status", () => {
      render(<Tasks />);
      fireEvent.click(screen.getByRole("combobox"));
      const options = screen.getAllByRole("option");
      const completedOption = options.find(
        (el) => el.textContent === "Completed",
      );
      if (completedOption) fireEvent.click(completedOption);
      expect(screen.getByText("Generate weekly report")).toBeDefined();
      expect(screen.queryByText("Process email inbox")).toBeNull();
    });
  });

  describe("Crons", () => {
    it("renders automated schedules", () => {
      render(<Crons />);
      expect(screen.getByText("Automated Schedules")).toBeDefined();
      expect(screen.getByText("Daily email digest")).toBeDefined();
      expect(screen.getByText("Every day at 9:00 AM")).toBeDefined();
      expect(screen.getByText("Weekly report generation")).toBeDefined();
      expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
    });
  });

  describe("Integrations", () => {
    it("renders integration cards", () => {
      render(<Integrations />);
      expect(screen.getByText("Gmail")).toBeDefined();
      expect(screen.getByText("Slack")).toBeDefined();
      expect(screen.getByText("Google Calendar")).toBeDefined();
      expect(screen.getByText("Notion")).toBeDefined();
    });

    it("shows Manage for connected and Connect for not connected", () => {
      render(<Integrations />);
      expect(
        screen.getAllByRole("button", { name: "Manage" }).length,
      ).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Connect" })).toBeDefined();
    });
  });

  describe("Settings", () => {
    it("renders profile and notifications", () => {
      render(<Settings />);
      expect(screen.getByText("Profile")).toBeDefined();
      expect(screen.getByLabelText(/name/i)).toBeDefined();
      expect(screen.getByLabelText(/email/i)).toBeDefined();
      expect(screen.getByText("Notifications")).toBeDefined();
      expect(screen.getByText("Billing")).toBeDefined();
    });

    it("toggles notifications", () => {
      render(<Settings />);
      const toggle = screen.getByRole("button", { name: /on|off/i });
      expect(toggle).toBeDefined();
      fireEvent.click(toggle);
      expect(screen.getByRole("button", { name: /off/i })).toBeDefined();
    });

    it("updates profile name and email", () => {
      render(<Settings />);
      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: "Jane Doe" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "jane@example.com" },
      });
      expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe(
        "Jane Doe",
      );
      expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(
        "jane@example.com",
      );
    });
  });
});
