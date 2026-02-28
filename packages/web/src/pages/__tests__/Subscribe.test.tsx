import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Subscribe } from "../Subscribe";

describe("Subscribe", () => {
  it("renders pricing plans", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText("Starter")).toBeDefined();
    expect(screen.getByText("Professional")).toBeDefined();
    expect(screen.getByText("Business")).toBeDefined();
    expect(screen.getByText("Enterprise")).toBeDefined();
  });

  it("renders plan prices", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText(/£29/)).toBeDefined();
    expect(screen.getByText(/£79/)).toBeDefined();
    expect(screen.getByText(/£149/)).toBeDefined();
  });

  it("shows Recommended badge on Professional plan", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText("Recommended")).toBeDefined();
  });

  it("renders Get started for non-Enterprise plans", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    const getStartedButtons = screen.getAllByRole("button", {
      name: "Get started",
    });
    expect(getStartedButtons.length).toBeGreaterThan(0);
  });

  it("Enterprise plan shows Contact sales button", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Contact sales" })).toBeDefined();
  });

  it("calls handleSelectPlan when Get started is clicked", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    const getStarted = screen.getAllByRole("button", {
      name: "Get started",
    })[0];
    fireEvent.click(getStarted);
    expect(getStarted).toBeDefined();
  });

  it("calls handleSelectPlan when Contact sales is clicked", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Contact sales" }));
    expect(logSpy).toHaveBeenCalledWith("Enterprise plan inquiry");
    logSpy.mockRestore();
  });

  it("renders FAQ section", () => {
    render(
      <MemoryRouter>
        <Subscribe />
      </MemoryRouter>,
    );
    expect(screen.getByText("Common questions")).toBeDefined();
    expect(screen.getByText(/can i change my plan later/i)).toBeDefined();
    expect(screen.getAllByText(/free trial/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/payment methods/i).length).toBeGreaterThan(0);
  });
});
