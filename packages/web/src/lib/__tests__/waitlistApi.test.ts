import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { joinWaitlist, unsubscribeWaitlist } from "../waitlistApi";

describe("waitlistApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ status: "joined" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("joinWaitlist posts email and interestedIn", async () => {
    const fetchMock = vi.mocked(fetch);
    await joinWaitlist({ email: "a@b.com", interestedIn: "pro" });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/waitlist$/),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "a@b.com", interestedIn: "pro" }),
      }),
    );
  });

  it("joinWaitlist returns ok when API returns joined", async () => {
    const result = await joinWaitlist({
      email: "a@b.com",
      interestedIn: "free",
    });
    expect(result).toEqual({ ok: true, status: "joined" });
  });

  it("joinWaitlist returns ok when API returns updated", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ status: "updated" }),
    } as Response);
    const result = await joinWaitlist({
      email: "a@b.com",
      interestedIn: "enterprise",
    });
    expect(result).toEqual({ ok: true, status: "updated" });
  });

  it("joinWaitlist maps 429 to friendly error", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({ success: false, error: "Too many requests" }),
    } as Response);
    const result = await joinWaitlist({
      email: "a@b.com",
      interestedIn: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/too many/i);
    }
  });

  it("unsubscribeWaitlist sends DELETE with token query", async () => {
    const fetchMock = vi.mocked(fetch);
    await unsubscribeWaitlist("tok-1");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("token=tok-1"),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("unsubscribeWaitlist returns ok on success", async () => {
    const result = await unsubscribeWaitlist("tok-1");
    expect(result).toEqual({ ok: true });
  });

  it("unsubscribeWaitlist returns error when token unknown", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: "Token not found" }),
    } as Response);
    const result = await unsubscribeWaitlist("bad");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Token not found");
    }
  });

  it("joinWaitlist handles non-JSON error body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("bad json")),
    } as Response);
    const result = await joinWaitlist({
      email: "a@b.com",
      interestedIn: "free",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/something went wrong/i);
    }
  });
});
