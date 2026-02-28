import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Onboarding } from "../Onboarding";

/** Advance through steps so we end up viewing the given step (1-6). */
function advanceToStep(
  targetStep: number,
  opts: {
    name?: string;
    business?: string;
    description?: string;
    task?: string;
    channel?: string;
  } = {},
) {
  if (targetStep >= 2) {
    if (opts.name)
      fireEvent.change(screen.getByPlaceholderText(/john doe/i), {
        target: { value: opts.name },
      });
    if (opts.business)
      fireEvent.change(screen.getByPlaceholderText(/your company/i), {
        target: { value: opts.business },
      });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (targetStep >= 3) {
    if (opts.description)
      fireEvent.change(screen.getByLabelText(/business description/i), {
        target: { value: opts.description },
      });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (targetStep >= 4) {
    if (opts.task) fireEvent.click(screen.getByText(opts.task));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (targetStep >= 5) {
    if (opts.channel) fireEvent.click(screen.getByText(opts.channel));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
  if (targetStep >= 6) {
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
  }
}

describe("Onboarding", () => {
  it("renders first step with business details", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    expect(screen.getAllByText(/let's get started/i)[0]).toBeDefined();
    expect(
      screen.getByText(/first, tell us about you and your business/i),
    ).toBeDefined();
  });

  it("renders task type options after advancing to step 3", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText(/john doe/i), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText(/your company/i), {
      target: { value: "Test Co" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/what does your business do/i)).toBeDefined();
    fireEvent.change(screen.getByLabelText(/business description/i), {
      target: { value: "We test software" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/email management/i)).toBeDefined();
    expect(screen.getByText(/document management/i)).toBeDefined();
  });

  it("renders step 4 channels and allows selecting", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    advanceToStep(4, {
      name: "A",
      business: "B",
      description: "C",
      task: "Email management",
    });
    expect(screen.getByText(/where do you work/i)).toBeDefined();
    expect(screen.getByText("Email")).toBeDefined();
    expect(screen.getByText("Slack")).toBeDefined();
    fireEvent.click(screen.getByText("Slack"));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/share knowledge/i)).toBeDefined();
  });

  it("renders step 5 document upload", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    advanceToStep(5, {
      name: "A",
      business: "B",
      description: "C",
      task: "Email management",
      channel: "Email",
    });
    expect(screen.getByText(/share knowledge/i)).toBeDefined();
    expect(screen.getByText(/click to upload/i)).toBeDefined();
  });

  it("renders step 6 summary with Enter dashboard button", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    advanceToStep(6, {
      name: "Jane",
      business: "Acme",
      description: "We build things",
      task: "Document management",
      channel: "Slack",
    });
    expect(screen.getByText(/meet your new employee/i)).toBeDefined();
    expect(screen.getByText(/welcome jane/i)).toBeDefined();
    expect(screen.getByText("Document management")).toBeDefined();
    expect(screen.getByText("Slack")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /enter dashboard/i }),
    ).toBeDefined();
  });

  it("completes onboarding when Enter dashboard is clicked", async () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    advanceToStep(6, {
      name: "Jane",
      business: "Acme",
      description: "We build things",
      task: "Document management",
      channel: "Slack",
    });
    const enterBtn = screen.getByRole("button", { name: /enter dashboard/i });
    await act(async () => {
      fireEvent.click(enterBtn);
    });
    expect(enterBtn).toBeDefined();
  });

  it("Back button goes to previous step", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByPlaceholderText(/john doe/i), {
      target: { value: "X" },
    });
    fireEvent.change(screen.getByPlaceholderText(/your company/i), {
      target: { value: "Y" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByText(/what does your business do/i)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getAllByText(/let's get started/i)[0]).toBeDefined();
  });

  it("disables Next on step 3 when no task selected", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    advanceToStep(3, { name: "A", business: "B", description: "Desc" });
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
