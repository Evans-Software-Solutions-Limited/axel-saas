import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Settings } from "../Settings";

afterEach(() => {
  cleanup();
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
