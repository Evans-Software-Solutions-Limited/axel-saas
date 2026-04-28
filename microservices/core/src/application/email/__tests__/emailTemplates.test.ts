import { describe, it, expect, vi } from "vitest";
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

  it("escapes the footer MARKETING_URL like every other dynamic href", async () => {
    // Regression: MARKETING_URL was interpolated raw into the default
    // footer's `href` while CTA and unsubscribe URLs went through
    // `escapeHtml`. A `MARKETING_URL` containing `"` would have closed
    // the attribute. Reload the module with a pathological env value so
    // the module-scoped const captures it.
    const before = process.env.MARKETING_URL;
    process.env.MARKETING_URL = 'https://example.com/"><script>x</script>';
    try {
      vi.resetModules();
      const { renderTemplate: render } = await import("../emailTemplates");
      // `welcome` has no unsubscribeLink → renders the default footer.
      const rendered = render("welcome", { name: "X" });
      expect(rendered.html).not.toContain("<script>x</script>");
      expect(rendered.html).toContain("&quot;");
    } finally {
      if (before === undefined) {
        delete process.env.MARKETING_URL;
      } else {
        process.env.MARKETING_URL = before;
      }
      vi.resetModules();
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

  it("subscription-cancelled renders the supplied endsAt instead of the generic fallback", () => {
    const rendered = renderTemplate("subscription-cancelled", {
      endsAt: "15 May 2026",
    });
    expect(rendered.html).toContain("15 May 2026");
    expect(rendered.html).not.toContain("the end of your billing period");
  });

  it("subscription-cancelled falls back to a generic phrase when endsAt is omitted", () => {
    const rendered = renderTemplate("subscription-cancelled", {});
    expect(rendered.html).toContain("the end of your billing period");
  });

  it("renders usage-warning with the supplied usagePercent value", () => {
    const rendered = renderTemplate("usage-warning", {
      usagePercent: "92",
    });
    expect(rendered.html).toContain("92%");
    // Defaults to 80 only when no value is provided.
    expect(rendered.html).not.toContain("80%");
  });

  it("falls back to 80% when usagePercent is missing", () => {
    const rendered = renderTemplate("usage-warning", {});
    expect(rendered.html).toContain("80%");
  });

  it("throws for unknown templates", () => {
    expect(() =>
      renderTemplate("not-a-template" as EmailTemplate, {}),
    ).toThrow();
  });
});
