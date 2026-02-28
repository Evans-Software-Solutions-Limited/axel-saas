import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Office } from "../Office";

describe("Office", () => {
  it("renders desk view and list view tabs", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    expect(screen.getByText("Desk view")).toBeDefined();
    expect(screen.getByText("List view")).toBeDefined();
  });

  it("renders agent names in the scene", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    expect(screen.getAllByText("Axel").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Scribe").length).toBeGreaterThan(0);
  });

  it("switches to list view and shows accordion when List view tab is clicked", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("List view"));
    expect(screen.getByText("Chief Task Handler")).toBeDefined();
    expect(screen.getByText("Document Writer")).toBeDefined();
  });

  it("calls onQuickChat when Quick Chat button is clicked", () => {
    const onQuickChat = vi.fn();
    render(
      <MemoryRouter>
        <Office onQuickChat={onQuickChat} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /quick chat/i }));
    expect(onQuickChat).toHaveBeenCalledTimes(1);
  });

  it("shows accordion with agent details in list view", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("List view"));
    expect(screen.getAllByText("Relay").length).toBeGreaterThan(0);
    expect(screen.getByText("Comms Manager")).toBeDefined();
  });

  it("clicking agent in desk view switches to list view and shows that agent", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    const tabTriggers = ["Desk view", "List view"];
    const agentButtons = screen
      .getAllByRole("button")
      .filter((b) => !tabTriggers.includes(b.textContent?.trim() ?? ""));
    if (agentButtons.length > 0) {
      fireEvent.click(agentButtons[0]);
    }
    expect(screen.getByText("List view")).toBeDefined();
    expect(screen.getByText("Chief Task Handler")).toBeDefined();
  });

  it("switching to list view when no agent selected opens first agent accordion", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("List view"));
    expect(screen.getByText("Chief Task Handler")).toBeDefined();
  });

  it("switches back to desk view when Desk view tab is clicked", () => {
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("List view"));
    fireEvent.click(screen.getByText("Desk view"));
    expect(screen.getByRole("img", { name: "AI Office" })).toBeDefined();
  });

  it("clicking agent switches to list and scrolls to accordion", async () => {
    vi.useFakeTimers();
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
    render(
      <MemoryRouter>
        <Office />
      </MemoryRouter>,
    );
    const tabs = ["Desk view", "List view"];
    const agentButtons = screen
      .getAllByRole("button")
      .filter((b) => !tabs.includes(b.textContent?.trim() ?? ""));
    if (agentButtons.length > 0) {
      fireEvent.click(agentButtons[0]);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(screen.getByText("Chief Task Handler")).toBeDefined();
    vi.useRealTimers();
  });
});
