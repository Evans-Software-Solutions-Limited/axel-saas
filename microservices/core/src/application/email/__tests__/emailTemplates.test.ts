import { describe, it, expect } from "vitest";
import { renderTemplate, type EmailTemplate } from "../emailTemplates";

const ALL_TEMPLATES: EmailTemplate[] = [
  "waitlist-joined",
  "waitlist-updated",
  "welcome",
  "subscription-confirmed",
  "subscription-cancelled",
  "payment-failed",
  "usage-warning",
  "daily-limit-reached",
];

describe("renderTemplate", () => {
  it("produces a non-empty subject and html for every supported template", () => {
    for (const template of ALL_TEMPLATES) {
      const rendered = renderTemplate(template, {
        name: "Brad",
        tier: "premium",
        interestedIn: "premium",
        dashboardUrl: "https://app.meetaxel.ai/dashboard",
        unsubscribeLink: "https://app.meetaxel.ai/waitlist/unsubscribe?token=x",
        resetAt: "midnight UTC",
        usagePercent: "82",
      });
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.html.length).toBeGreaterThan(0);
      expect(rendered.html).toContain("<body");
      expect(rendered.html).toContain("</body>");
    }
  });

  it("escapes HTML in interpolated data values", () => {
    const rendered = renderTemplate("welcome", {
      name: "<script>alert(1)</script>",
      dashboardUrl: "https://app.meetaxel.ai/dashboard",
    });
    expect(rendered.html).not.toContain("<script>alert(1)</script>");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("includes an unsubscribe link when provided", () => {
    const rendered = renderTemplate("waitlist-joined", {
      interestedIn: "premium",
      unsubscribeLink: "https://example.com/unsubscribe?token=abc",
    });
    expect(rendered.html).toContain("Unsubscribe");
    expect(rendered.html).toContain(
      "https://example.com/unsubscribe?token=abc",
    );
  });

  it("throws for unknown templates", () => {
    expect(() =>
      renderTemplate("not-a-template" as EmailTemplate, {}),
    ).toThrow();
  });
});
