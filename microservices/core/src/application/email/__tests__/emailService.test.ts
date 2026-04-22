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
