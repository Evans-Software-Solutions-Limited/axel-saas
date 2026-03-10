import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Tasks } from "../Tasks";

afterEach(() => {
  cleanup();
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
