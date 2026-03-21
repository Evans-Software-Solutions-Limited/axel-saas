import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { WaitlistUnsubscribe } from "../WaitlistUnsubscribe";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: false,
    signOut: vi.fn(),
  })),
}));

describe("WaitlistUnsubscribe", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: "removed" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls unsubscribe API with token from query", async () => {
    const fetchMock = vi.mocked(fetch);
    render(
      <MemoryRouter initialEntries={["/waitlist/unsubscribe?token=tok-xyz"]}>
        <WaitlistUnsubscribe />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("token=tok-xyz"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    expect(
      screen.getByRole("heading", { name: /you.re off the list/i }),
    ).toBeDefined();
  });

  it("shows error when token is missing", async () => {
    render(
      <MemoryRouter initialEntries={["/waitlist/unsubscribe"]}>
        <WaitlistUnsubscribe />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/missing token/i)).toBeDefined();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
