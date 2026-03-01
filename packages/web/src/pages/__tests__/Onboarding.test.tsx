import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import Onboarding from "../Onboarding";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("Onboarding - Chat-Style Flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders first question from Axel", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Hey! I'm Axel/)).toBeDefined();
  });

  it("displays progress indicator", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    expect(screen.getByText("1 of 6")).toBeDefined();
  });

  it("accepts user input", async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type your answer...") as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      fireEvent.change(input, { target: { value: "Alice" } });
    });

    expect(input.value).toBe("Alice");
  });

  it("renders input field with correct placeholder", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type your answer...");
    expect(input).toBeDefined();
  });

  it("disables send button when input is empty", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const sendButton = screen.getByRole("button");
    expect((sendButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("enables send button when input has text", async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Type your answer...") as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { value: "Alice" } });
    });

    const sendButton = screen.getByRole("button") as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
  });

  it("renders progress bar", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const progressText = screen.getByText("1 of 6");
    expect(progressText).toBeDefined();
  });

  it("displays Axel avatar", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const avatars = screen.getAllByText("⚡");
    expect(avatars.length).toBeGreaterThan(0);
  });
});
