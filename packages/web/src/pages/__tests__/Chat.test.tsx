import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { Chat } from "../Chat";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
    cleanup();
  });
});
