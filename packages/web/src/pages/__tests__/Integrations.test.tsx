import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Integrations } from "../Integrations";

afterEach(() => {
  cleanup();
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
