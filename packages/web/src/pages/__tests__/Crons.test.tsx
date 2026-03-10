import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Crons } from "../Crons";

afterEach(() => {
  cleanup();
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
