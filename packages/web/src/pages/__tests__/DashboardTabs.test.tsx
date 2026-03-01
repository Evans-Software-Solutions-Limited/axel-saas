// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Chat, Tasks, Crons, Integrations, Settings } from "../DashboardTabs";

describe("DashboardTabs", () => {
  describe("Chat", () => {
    it("renders initial message from Axel", () => {
      render(<Chat />);
      expect(screen.getByText(/how can i help you today/i)).toBeDefined();
    });

    it("sends message when user types and submits", () => {
      render(<Chat />);
      const input = screen.getByPlaceholderText(/tell axel/i);
      fireEvent.change(input, { target: { value: "Hello" } });
      const sendButton = screen.getByRole("button");
      fireEvent.click(sendButton);
      expect(screen.getByText("Hello")).toBeDefined();
    });

    it("sends message when user presses Enter", () => {
      render(<Chat />);
      const input = screen.getByPlaceholderText(/tell axel/i);
      fireEvent.change(input, { target: { value: "Enter test" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });
      expect(screen.getByText("Enter test")).toBeDefined();
    });

    it("does not send when input is empty", () => {
      render(<Chat />);
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
      render(<Chat />);
      const input = screen.getByPlaceholderText(/tell axel/i);
      fireEvent.change(input, { target: { value: "Help me" } });
      fireEvent.click(screen.getByRole("button"));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(screen.getByText("I'm processing your request...")).toBeDefined();
      vi.useRealTimers();
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
