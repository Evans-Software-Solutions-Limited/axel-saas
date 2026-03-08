import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Onboarding } from "../Onboarding";

describe("Onboarding - Conversational Flow", () => {
  it("renders intro screen with welcome message", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    expect(screen.getByText(/welcome to axel/i)).toBeDefined();
    expect(
      screen.getByRole("button", { name: /let's get started/i }),
    ).toBeDefined();
  });

  it("starts conversation when clicking get started", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    expect(screen.getByText(/first, what should i call you/i)).toBeDefined();
  });

  it("asks for business name after providing name", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );
    // Start onboarding
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));

    // Enter name
    const input = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(input, { target: { value: "John" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText(/so, what does your business do/i)).toBeDefined();
  });

  it("asks for business description after providing business name", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Start and provide name
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: "John" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });

    // Provide business name
    const businessInput = screen.getByPlaceholderText(/your business name/i);
    fireEvent.change(businessInput, { target: { value: "Acme Inc" } });
    fireEvent.keyDown(businessInput, { key: "Enter" });

    expect(
      screen.getByText(/tell me a bit about what your business does/i),
    ).toBeDefined();
  });

  it("shows task selection after business description", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Start and provide name
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    const nameInput = screen.getByPlaceholderText(/your name/i);
    fireEvent.change(nameInput, { target: { value: "John" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });

    // Provide business name
    const businessInput = screen.getByPlaceholderText(/your business name/i);
    fireEvent.change(businessInput, { target: { value: "Acme" } });
    fireEvent.keyDown(businessInput, { key: "Enter" });

    // Provide business description
    const descInput = screen.getByPlaceholderText(
      /tell me about your business/i,
    );
    fireEvent.change(descInput, { target: { value: "We build software" } });
    fireEvent.keyDown(descInput, { key: "Enter" });

    expect(screen.getByText(/what are the main tasks/i)).toBeDefined();
    expect(screen.getByText("Email management")).toBeDefined();
  });

  it("allows selecting multiple tasks", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Navigate to tasks
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "John" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your name/i), {
      key: "Enter",
    });
    fireEvent.change(screen.getByPlaceholderText(/your business name/i), {
      target: { value: "Acme" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your business name/i), {
      key: "Enter",
    });
    fireEvent.change(
      screen.getByPlaceholderText(/tell me about your business/i),
      { target: { value: "Software" } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText(/tell me about your business/i),
      { key: "Enter" },
    );

    // Select tasks
    fireEvent.click(screen.getByText("Email management"));
    fireEvent.click(screen.getByText("Document management"));

    // Click continue
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Should go to channels
    expect(screen.getByText(/which communication channels/i)).toBeDefined();
  });

  it("allows selecting channels and completes onboarding", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Navigate to tasks
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "Jane" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your name/i), {
      key: "Enter",
    });
    fireEvent.change(screen.getByPlaceholderText(/your business name/i), {
      target: { value: "TestCo" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your business name/i), {
      key: "Enter",
    });
    fireEvent.change(
      screen.getByPlaceholderText(/tell me about your business/i),
      { target: { value: "Testing" } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText(/tell me about your business/i),
      { key: "Enter" },
    );

    // Select tasks and continue
    fireEvent.click(screen.getByText("Email management"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Select channels
    fireEvent.click(screen.getByText("Email"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    // Should show summary
    expect(screen.getByText(/all done, jane/i)).toBeDefined();
    expect(screen.getByText("Enter dashboard")).toBeDefined();
  });

  it("disables continue on tasks phase when no tasks selected", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Navigate to tasks
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "John" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your name/i), {
      key: "Enter",
    });
    fireEvent.change(screen.getByPlaceholderText(/your business name/i), {
      target: { value: "Acme" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your business name/i), {
      key: "Enter",
    });
    fireEvent.change(
      screen.getByPlaceholderText(/tell me about your business/i),
      { target: { value: "Software" } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText(/tell me about your business/i),
      { key: "Enter" },
    );

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables continue on channels phase when no channels selected", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Navigate to channels
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));
    fireEvent.change(screen.getByPlaceholderText(/your name/i), {
      target: { value: "John" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your name/i), {
      key: "Enter",
    });
    fireEvent.change(screen.getByPlaceholderText(/your business name/i), {
      target: { value: "Acme" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText(/your business name/i), {
      key: "Enter",
    });
    fireEvent.change(
      screen.getByPlaceholderText(/tell me about your business/i),
      { target: { value: "Software" } },
    );
    fireEvent.keyDown(
      screen.getByPlaceholderText(/tell me about your business/i),
      { key: "Enter" },
    );
    fireEvent.click(screen.getByText("Email management"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("prevents empty submissions in text inputs", () => {
    render(
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>,
    );

    // Start onboarding
    fireEvent.click(screen.getByRole("button", { name: /let's get started/i }));

    // Try to submit empty input
    const input = screen.getByPlaceholderText(/your name/i);
    fireEvent.keyDown(input, { key: "Enter" });

    // Should still be on name phase (no error, just no submission)
    expect(screen.getByText(/first, what should i call you/i)).toBeDefined();
  });
});
