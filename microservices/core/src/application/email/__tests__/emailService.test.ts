import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Resend SDK before importing the service.
const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import {
  sendEmail,
  resetEmailClient,
  resetEmailRateLimiter,
} from "../emailService";

const OLD_ENV = process.env;

beforeEach(() => {
  sendMock.mockReset();
  sendMock.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  resetEmailClient();
  resetEmailRateLimiter();
  process.env = { ...OLD_ENV, RESEND_API_KEY: "re_test_key" };
});

afterEach(() => {
  process.env = OLD_ENV;
});

describe("sendEmail", () => {
  it("calls Resend with rendered subject and html", async () => {
    await sendEmail({
      template: "welcome",
      to: "user@example.com",
      data: {
        name: "Brad",
        dashboardUrl: "https://app.meetaxel.ai/dashboard",
      },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const arg = sendMock.mock.calls[0][0];
    expect(arg.to).toBe("user@example.com");
    expect(arg.subject).toBeTruthy();
    expect(arg.html).toContain("Brad");
  });

  it("uses EMAIL_FROM_ADDRESS override when set", async () => {
    process.env.EMAIL_FROM_ADDRESS = "Custom <hi@example.com>";
    await sendEmail({
      template: "welcome",
      to: "u@e.com",
      data: { name: "X" },
    });
    expect(sendMock.mock.calls[0][0].from).toBe("Custom <hi@example.com>");
  });

  it("falls back to the default from-address when EMAIL_FROM_ADDRESS is empty", async () => {
    // SST's `infra/api.ts` binds the env var as
    // `process.env.EMAIL_FROM_ADDRESS || ""` so the Lambda env always has the
    // key. The service must coalesce empty strings to the default — `??`
    // would let "" through and Resend would reject the send.
    process.env.EMAIL_FROM_ADDRESS = "";
    await sendEmail({
      template: "welcome",
      to: "u@e.com",
      data: { name: "X" },
    });
    expect(sendMock.mock.calls[0][0].from).toBe("Axel <hello@meetaxel.ai>");
  });

  it("skips sending if RESEND_API_KEY is not set (no crash)", async () => {
    delete process.env.RESEND_API_KEY;
    resetEmailClient();
    await expect(
      sendEmail({ template: "welcome", to: "u@e.com", data: {} }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("never throws when Resend rejects (fire-and-forget)", async () => {
    sendMock.mockRejectedValueOnce(new Error("resend unavailable"));
    await expect(
      sendEmail({ template: "welcome", to: "u@e.com", data: { name: "X" } }),
    ).resolves.toBeUndefined();
  });

  it("refuses to send when recipient is invalid", async () => {
    await sendEmail({
      template: "welcome",
      to: "" as unknown as string,
      data: {},
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("swallows template render errors without throwing", async () => {
    await expect(
      sendEmail({
        template: "nonsense" as never,
        to: "u@e.com",
        data: {},
      }),
    ).resolves.toBeUndefined();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rate-limits usage-warning to once per recipient per 24h", async () => {
    await sendEmail({
      template: "usage-warning",
      to: "dup@example.com",
      data: { usagePercent: "82" },
    });
    await sendEmail({
      template: "usage-warning",
      to: "dup@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits daily-limit-reached to once per recipient per 24h", async () => {
    await sendEmail({
      template: "daily-limit-reached",
      to: "hit@example.com",
      data: { resetAt: "midnight UTC" },
    });
    await sendEmail({
      template: "daily-limit-reached",
      to: "hit@example.com",
      data: { resetAt: "midnight UTC" },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("does not rate-limit transactional templates", async () => {
    await sendEmail({
      template: "welcome",
      to: "t@example.com",
      data: { name: "X" },
    });
    await sendEmail({
      template: "welcome",
      to: "t@example.com",
      data: { name: "X" },
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("does not burn the rate-limit window on a failed send", async () => {
    // First attempt rejects (e.g. transient Resend outage). The bucket must
    // NOT be marked, so a retry inside the 24h window is allowed through.
    sendMock.mockRejectedValueOnce(new Error("resend down"));
    await sendEmail({
      template: "usage-warning",
      to: "retry@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    // Second attempt (immediately after) must not be throttled.
    await sendEmail({
      template: "usage-warning",
      to: "retry@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    // After a confirmed success the bucket IS recorded — third attempt is throttled.
    await sendEmail({
      template: "usage-warning",
      to: "retry@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("treats Resend API errors (resolved with { error }) as failed sends", async () => {
    // The Resend SDK resolves with `{ data: null, error: {...} }` on API
    // errors rather than throwing. Without inspecting `result.error` the
    // service silently logs a successful send AND records the rate-limit
    // bucket, suppressing the next 24h of attempts.
    sendMock.mockResolvedValueOnce({
      data: null,
      error: {
        name: "validation_error",
        message: "Invalid `to` field",
      },
    });
    await sendEmail({
      template: "usage-warning",
      to: "broken@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    // Bucket must NOT be stamped — a retry within 24h goes through.
    await sendEmail({
      template: "usage-warning",
      to: "broken@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it("treats different recipients as separate rate-limit buckets", async () => {
    await sendEmail({
      template: "usage-warning",
      to: "a@example.com",
      data: { usagePercent: "82" },
    });
    await sendEmail({
      template: "usage-warning",
      to: "b@example.com",
      data: { usagePercent: "82" },
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
