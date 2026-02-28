import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
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

    const input = screen.getByPlaceholderText("Your name") as HTMLInputElement;
    expect(input).toBeDefined();

    await act(async () => {
      input.value = "Alice";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(input.value).toBe("Alice");
  });

  it("renders input field with correct placeholder", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    const input = screen.getByPlaceholderText("Your name");
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

    const input = screen.getByPlaceholderText("Your name") as HTMLInputElement;

    await act(async () => {
      input.value = "Alice";
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const sendButton = screen.getByRole("button");
    expect((sendButton as HTMLButtonElement).disabled).toBe(false);
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

    const avatar = screen.getByText("⚡");
    expect(avatar).toBeDefined();
  });
});
