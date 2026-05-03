import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { Settings } from "../Settings";
import {
  fetchInvoices,
  fetchSubscriptionStatus,
  openCustomerPortal,
  type SubscriptionInfo,
  type InvoiceSummary,
} from "../settings/settingsApi";
import { fetchUsageSummary } from "../usage/usageApi";

vi.mock("../settings/settingsApi", () => ({
  fetchSubscriptionStatus: vi.fn(),
  fetchInvoices: vi.fn(),
  openCustomerPortal: vi.fn(),
}));

vi.mock("../usage/usageApi", () => ({
  fetchUsageSummary: vi.fn(),
}));

const assignMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    value: { assign: assignMock },
    writable: true,
  });
  // Default fetches resolve to a free-tier user with no invoices so basic
  // render tests don't have to set up mocks individually.
  vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  } satisfies SubscriptionInfo);
  vi.mocked(fetchInvoices).mockResolvedValue([]);
  // Default: empty-state usage so the Usage card renders without
  // affecting the rest of the assertions.
  vi.mocked(fetchUsageSummary).mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe("Settings", () => {
  it("renders profile, notifications and billing sections", async () => {
    render(<Settings />);
    expect(screen.getByText("Profile")).toBeDefined();
    expect(screen.getByLabelText(/name/i)).toBeDefined();
    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByText("Notifications")).toBeDefined();
    expect(screen.getByText("Billing")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText("Free")).toBeDefined();
    });
  });

  it("toggles notifications (still UI-only stub)", () => {
    render(<Settings />);
    const toggle = screen.getByRole("button", { name: /on|off/i });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /off/i })).toBeDefined();
  });

  describe("billing", () => {
    it("shows a loading state before the subscription resolves", () => {
      vi.mocked(fetchSubscriptionStatus).mockImplementation(
        () => new Promise(() => {}),
      );
      render(<Settings />);
      // Match the billing-card loading text specifically. The Usage card
      // also renders its own "Loading usage…" — the regex is anchored to
      // the bare "Loading…" so the assertion stays unambiguous.
      expect(screen.getByText(/^Loading…$/)).toBeDefined();
    });

    it("shows an error message when the subscription fetch fails", async () => {
      // Subscription failure is fatal for the section — without a tier we
      // can't render the right CTAs.
      vi.mocked(fetchSubscriptionStatus).mockRejectedValue(
        new Error("Subscription endpoint unavailable"),
      );
      render(<Settings />);
      await waitFor(() => {
        expect(
          screen.getByText(/subscription endpoint unavailable/i),
        ).toBeDefined();
      });
    });

    it("still renders billing actions when only the invoices fetch fails", async () => {
      // A Stripe outage on /stripe/invoices must not hide the locally-known
      // tier or the Manage / Cancel buttons.
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(fetchInvoices).mockRejectedValue(new Error("Stripe is down"));

      render(<Settings />);

      // Subscription section renders normally.
      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /cancel plan/i }),
      ).toBeDefined();

      // Invoices error appears inline within its own subsection.
      expect(screen.getByText(/stripe is down/i)).toBeDefined();
    });

    it("renders the Free tier upgrade CTA and routes to /subscribe", async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /upgrade to premium/i }),
        ).toBeDefined();
      });
      fireEvent.click(
        screen.getByRole("button", { name: /upgrade to premium/i }),
      );
      expect(assignMock).toHaveBeenCalledWith("/subscribe");
    });

    it("does not render Manage / Cancel buttons for Free tier", async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText("Free")).toBeDefined();
      });
      expect(
        screen.queryByRole("button", { name: /manage subscription/i }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    });

    it("does not render the invoices section for Free tier", async () => {
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText("Free")).toBeDefined();
      });
      expect(screen.queryByText(/recent invoices/i)).toBeNull();
    });

    it("renders the Premium tier with renewal date and invoices", async () => {
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(fetchInvoices).mockResolvedValue([
        {
          id: "inv_1",
          number: "INV-001",
          status: "paid",
          amountPaid: 4900,
          currency: "gbp",
          created: 1715731200, // 15 May 2024
          hostedInvoiceUrl: "https://stripe.com/invoice/inv_1",
          invoicePdf: "https://stripe.com/invoice/inv_1.pdf",
          periodStart: 1713139200,
          periodEnd: 1715731200,
        } satisfies InvoiceSummary,
      ]);

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      expect(
        screen.getByText(/£49\/month · renews 15 may 2026/i),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /cancel plan/i }),
      ).toBeDefined();
      expect(screen.getByText(/recent invoices/i)).toBeDefined();
      expect(screen.getByText("£49.00")).toBeDefined();
      expect(
        screen.getByRole("link", { name: /^view$/i }).getAttribute("href"),
      ).toBe("https://stripe.com/invoice/inv_1");
    });

    it("Premium → Manage subscription → opens Stripe portal default flow", async () => {
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(openCustomerPortal).mockResolvedValue({
        url: "https://billing.stripe.com/p/session/manage_test",
      });

      render(<Settings />);
      const button = await screen.findByRole("button", {
        name: /manage subscription/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(openCustomerPortal).toHaveBeenCalledWith(undefined);
      });
      expect(assignMock).toHaveBeenCalledWith(
        "https://billing.stripe.com/p/session/manage_test",
      );
    });

    it("Premium → Cancel plan → opens Stripe portal cancel flow", async () => {
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(openCustomerPortal).mockResolvedValue({
        url: "https://billing.stripe.com/p/session/cancel_test",
      });

      render(<Settings />);
      const button = await screen.findByRole("button", {
        name: /cancel plan/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(openCustomerPortal).toHaveBeenCalledWith("cancel");
      });
      expect(assignMock).toHaveBeenCalledWith(
        "https://billing.stripe.com/p/session/cancel_test",
      );
    });

    it("shows a portal error and re-enables the buttons when the call fails", async () => {
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(openCustomerPortal).mockRejectedValue(
        new Error("Stripe is having a moment"),
      );

      render(<Settings />);
      const button = await screen.findByRole("button", {
        name: /manage subscription/i,
      });
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/stripe is having a moment/i)).toBeDefined();
      });
      // Buttons re-enabled so the user can retry.
      expect(
        (
          screen.getByRole("button", {
            name: /manage subscription/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });

    it("renders the cancelled-premium state with Manage billing only and no contradictory copy", async () => {
      // The customer.subscription.deleted webhook flips status to "cancelled"
      // but never downgrades the tier. The UI must reflect that — no
      // "Renews [date]" line, no Cancel button (the Stripe portal cancel
      // flow would error against a deleted subscription).
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "cancelled",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      expect(screen.getByText(/premium access ended/i)).toBeDefined();
      expect(screen.queryByText(/renews/i)).toBeNull();
      expect(screen.queryByText(/£49\/month/)).toBeNull();

      // Manage stays so the user can resubscribe / view past invoices via
      // the portal — the label changes to reflect that there's no active
      // subscription to manage.
      expect(
        screen.getByRole("button", { name: /manage billing/i }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    });

    it("renders the past-due premium state with both Manage and Cancel buttons", async () => {
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "past_due",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      // Both the Cancelled/Past-due status badge and the body copy use the
      // phrase "Payment failed". Match the body line specifically.
      expect(
        screen.getByText(/please update your payment method/i),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      // Cancel still available — past-due users should be able to cancel.
      expect(
        screen.getByRole("button", { name: /cancel plan/i }),
      ).toBeDefined();
    });

    it("renders 'Cancellation scheduled' (not 'Renews') when cancelAtPeriodEnd is true", async () => {
      // Stripe portal cancellations send subscription.updated with
      // status=active + cancel_at_period_end=true. The DB stays active
      // until period end, so without surfacing the flag the UI would
      // misleadingly show "Renews [date]" right after the user cancelled.
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: true,
      });

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      expect(screen.getByText(/cancellation scheduled/i)).toBeDefined();
      expect(screen.getByText(/active until 15 may 2026/i)).toBeDefined();
      expect(screen.queryByText(/renews/i)).toBeNull();

      // Manage stays (lets the user resume the cancellation via the portal).
      // Cancel is hidden — they've already cancelled.
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    });

    it("renders the Enterprise tier without billing actions and without an invoices section", async () => {
      // Enterprise customers are on custom invoicing handled outside Stripe
      // — showing them an empty Stripe invoices panel is misleading.
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "enterprise",
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText("Enterprise")).toBeDefined();
      });
      expect(screen.queryByRole("button", { name: /upgrade/i })).toBeNull();
      expect(
        screen.queryByRole("button", { name: /manage subscription/i }),
      ).toBeNull();
      expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
      expect(screen.queryByText(/recent invoices/i)).toBeNull();
    });
  });

  describe("usage section", () => {
    it("renders the usage panel populated from fetchUsageSummary on success", async () => {
      vi.mocked(fetchUsageSummary).mockResolvedValue({
        tier: "free",
        daily: {
          inputTokens: 25_000,
          outputTokens: 10_000,
          limits: { inputTokens: 50_000, outputTokens: 25_000 },
        },
        monthly: { inputTokens: 0, outputTokens: 0, limits: null },
        percentUsed: 0.5,
        warningThreshold: 0.8,
      });
      render(<Settings />);
      // Card heading appears regardless.
      expect(screen.getByText(/^Usage$/)).toBeDefined();
      // Daily-allowance copy + bar values are rendered once the fetch resolves.
      await waitFor(() => {
        expect(screen.getByText(/daily allowance/i)).toBeDefined();
      });
      expect(screen.getByText(/25\.0k \/ 50\.0k/)).toBeDefined();
    });

    it("renders the inline error when fetchUsageSummary rejects", async () => {
      // A usage failure is independent of the billing fetches — both must
      // still render, but the usage card surfaces its own error message.
      vi.mocked(fetchUsageSummary).mockRejectedValue(
        new Error("Usage endpoint unavailable"),
      );
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText(/usage endpoint unavailable/i)).toBeDefined();
      });
      // Billing still renders normally.
      expect(screen.getByText("Free")).toBeDefined();
    });

    it("renders the empty-state copy when usage is null", async () => {
      vi.mocked(fetchUsageSummary).mockResolvedValue(null);
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText(/no usage recorded yet/i)).toBeDefined();
      });
    });
  });
});
