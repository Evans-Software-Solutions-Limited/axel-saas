import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db before imports
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  waitlist: {},
  waitlistInterestedInEnum: {},
}));

// Mock email service — always resolves instantly
vi.mock("../waitlistEmail", () => ({
  sendJoinConfirmation: vi.fn().mockResolvedValue(undefined),
  sendUpdateConfirmation: vi.fn().mockResolvedValue(undefined),
}));

const { mockUpsertByEmail, mockDeleteByToken } = vi.hoisted(() => ({
  mockUpsertByEmail: vi.fn(),
  mockDeleteByToken: vi.fn(),
}));

vi.mock("../waitlistRepository", () => ({
  WaitlistRepository: vi.fn().mockImplementation(() => ({
    upsertByEmail: mockUpsertByEmail,
    deleteByToken: mockDeleteByToken,
  })),
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "NotFoundError";
    }
  },
}));

import { waitlistHandler } from "../waitlistHandler";
import { sendJoinConfirmation, sendUpdateConfirmation } from "../waitlistEmail";
import { NotFoundError } from "../waitlistRepository";

const mockEntry = {
  id: "entry-uuid-1",
  email: "user@example.com",
  interestedIn: "pro" as const,
  token: "tok-abc-123",
  confirmedAt: new Date(),
  updatedAt: new Date(),
};

function makeRequest(
  method: string,
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    ip?: string;
  } = {},
) {
  const url = `http://localhost${path}`;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.ip ? { "x-forwarded-for": options.ip } : {}),
      ...options.headers,
    },
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  return new Request(url, init);
}

describe("waitlistHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertByEmail.mockResolvedValue({ record: mockEntry, isNew: true });
    mockDeleteByToken.mockResolvedValue(undefined);
  });

  // ─── Handler structure ───────────────────────────────────────────────────────

  it("exports a named waitlistHandler instance", () => {
    expect(waitlistHandler).toBeDefined();
    expect(waitlistHandler.routes).toBeDefined();
    expect(Array.isArray(waitlistHandler.routes)).toBe(true);
  });

  it("has a POST /waitlist route", () => {
    const route = waitlistHandler.routes.find(
      (r) => r.method === "POST" && r.path === "/waitlist",
    );
    expect(route).toBeDefined();
  });

  it("has a DELETE /waitlist/unsubscribe route", () => {
    const route = waitlistHandler.routes.find(
      (r) => r.method === "DELETE" && r.path === "/waitlist/unsubscribe",
    );
    expect(route).toBeDefined();
  });

  // ─── POST /waitlist — happy path join ────────────────────────────────────────

  it("returns 201 with status=joined for a new email", async () => {
    mockUpsertByEmail.mockResolvedValue({ record: mockEntry, isNew: true });

    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "pro" },
        ip: "1.2.3.4",
      }),
    );

    expect(res.status).toBe(201);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("joined");
  });

  it("calls upsertByEmail with the provided email and tier", async () => {
    await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "free" },
        ip: "1.2.3.4",
      }),
    );

    expect(mockUpsertByEmail).toHaveBeenCalledWith("user@example.com", "free");
  });

  it("fires sendJoinConfirmation asynchronously on new signup", async () => {
    await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "pro" },
        ip: "1.2.3.5",
      }),
    );

    // Allow microtask queue to flush
    await vi.runAllTimersAsync?.().catch(() => undefined);
    await Promise.resolve();

    expect(sendJoinConfirmation).toHaveBeenCalledWith(
      mockEntry.email,
      mockEntry.interestedIn,
      mockEntry.token,
    );
  });

  // ─── POST /waitlist — happy path update ─────────────────────────────────────

  it("returns 200 with status=updated for an existing email", async () => {
    mockUpsertByEmail.mockResolvedValue({ record: mockEntry, isNew: false });

    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "enterprise" },
        ip: "1.2.3.6",
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("updated");
  });

  it("fires sendUpdateConfirmation asynchronously on tier update", async () => {
    mockUpsertByEmail.mockResolvedValue({ record: mockEntry, isNew: false });

    await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "enterprise" },
        ip: "1.2.3.7",
      }),
    );

    await Promise.resolve();

    expect(sendUpdateConfirmation).toHaveBeenCalledWith(
      mockEntry.email,
      mockEntry.interestedIn,
      mockEntry.token,
    );
  });

  // ─── POST /waitlist — validation errors ─────────────────────────────────────

  it("returns 422 for an invalid email format", async () => {
    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "not-an-email", interestedIn: "pro" },
        ip: "1.2.3.8",
      }),
    );

    expect(res.status).toBe(422);
    const json = (await res.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
  });

  it("returns 400/422 for missing email field", async () => {
    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { interestedIn: "pro" },
        ip: "1.2.3.9",
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("returns 400/422 for missing interestedIn field", async () => {
    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com" },
        ip: "1.2.3.10",
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("returns 400/422 for invalid interestedIn value", async () => {
    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "starter" },
        ip: "1.2.3.11",
      }),
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it("accepts all valid interestedIn values: free, pro, enterprise", async () => {
    for (const tier of ["free", "pro", "enterprise"] as const) {
      mockUpsertByEmail.mockResolvedValue({
        record: { ...mockEntry, interestedIn: tier },
        isNew: true,
      });
      const res = await waitlistHandler.handle(
        makeRequest("POST", "/waitlist", {
          body: { email: "user@example.com", interestedIn: tier },
          ip: "2.0.0.1",
        }),
      );
      expect(res.status).toBe(201);
    }
  });

  // ─── POST /waitlist — rate limiting ─────────────────────────────────────────

  it("returns 429 after exceeding 10 requests/minute from same IP", async () => {
    const ip = "10.0.0.99";
    let lastStatus = 0;

    for (let i = 0; i < 12; i++) {
      const res = await waitlistHandler.handle(
        makeRequest("POST", "/waitlist", {
          body: { email: `u${i}@example.com`, interestedIn: "pro" },
          ip,
        }),
      );
      lastStatus = res.status;
    }

    expect(lastStatus).toBe(429);
  });

  // ─── DELETE /waitlist/unsubscribe — happy path ───────────────────────────────

  it("returns 200 with status=removed for a valid token", async () => {
    const res = await waitlistHandler.handle(
      makeRequest("DELETE", "/waitlist/unsubscribe?token=tok-abc-123"),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("removed");
  });

  it("calls deleteByToken with the provided token", async () => {
    await waitlistHandler.handle(
      makeRequest("DELETE", "/waitlist/unsubscribe?token=tok-abc-123"),
    );

    expect(mockDeleteByToken).toHaveBeenCalledWith("tok-abc-123");
  });

  // ─── DELETE /waitlist/unsubscribe — not found ────────────────────────────────

  it("returns 404 when token is not found", async () => {
    mockDeleteByToken.mockRejectedValue(
      new NotFoundError("Waitlist entry not found for that token"),
    );

    const res = await waitlistHandler.handle(
      makeRequest("DELETE", "/waitlist/unsubscribe?token=bad-token"),
    );

    expect(res.status).toBe(404);
    const json = (await res.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
  });

  it("returns 500 for unexpected errors from deleteByToken", async () => {
    mockDeleteByToken.mockRejectedValue(new Error("DB connection lost"));

    const res = await waitlistHandler.handle(
      makeRequest("DELETE", "/waitlist/unsubscribe?token=tok-abc"),
    );

    // Elysia catches unhandled errors and returns 500
    expect(res.status).toBe(500);
  });

  // ─── Token not exposed in responses ─────────────────────────────────────────

  it("does not expose token in the POST response", async () => {
    const res = await waitlistHandler.handle(
      makeRequest("POST", "/waitlist", {
        body: { email: "user@example.com", interestedIn: "pro" },
        ip: "5.6.7.8",
      }),
    );

    const body = await res.text();
    expect(body).not.toContain("tok-abc-123");
  });
});
