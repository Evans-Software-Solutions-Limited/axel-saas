import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { WaitlistForm } from "../WaitlistForm";

vi.mock("@/lib/waitlistApi", () => ({
  joinWaitlist: vi.fn(),
}));

import { joinWaitlist } from "@/lib/waitlistApi";

function renderForm(initial = "/") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <WaitlistForm />
    </MemoryRouter>,
  );
}

describe("WaitlistForm", () => {
  beforeEach(() => {
    vi.mocked(joinWaitlist).mockReset();
  });

  it("submits POST /waitlist payload with email and interestedIn", async () => {
    vi.mocked(joinWaitlist).mockResolvedValue({ ok: true, status: "joined" });
    renderForm("/");
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/interested in/i), {
      target: { value: "pro" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));
    await waitFor(() => {
      expect(joinWaitlist).toHaveBeenCalledWith({
        email: "user@example.com",
        interestedIn: "pro",
      });
    });
    expect(
      await screen.findByText(/on the list\. check your inbox/i),
    ).toBeDefined();
  });

  it("prefills tier from ?tier= query", () => {
    renderForm("/?tier=enterprise");
    const select = screen.getByLabelText(/interested in/i) as HTMLSelectElement;
    expect(select.value).toBe("enterprise");
  });

  it("shows API error message on failure", async () => {
    vi.mocked(joinWaitlist).mockResolvedValue({
      ok: false,
      error: "Too many requests. Try again in a minute.",
      status: 429,
    });
    renderForm("/");
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));
    expect(await screen.findByText(/too many requests/i)).toBeDefined();
  });

  it("shows updated message when status is updated", async () => {
    vi.mocked(joinWaitlist).mockResolvedValue({ ok: true, status: "updated" });
    renderForm("/");
    fireEvent.change(screen.getByLabelText(/^email$/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /join waitlist/i }));
    expect(await screen.findByText(/preference was updated/i)).toBeDefined();
  });
});
