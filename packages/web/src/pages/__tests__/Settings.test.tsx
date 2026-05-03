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

  it("accepts typed updates to the Profile name and email fields (UI-only stub)", () => {
    // Profile section is still a UI-only stub pending PUT /users/me. The
    // Input onChange handlers were silently uncovered — this exercises
    // them so the controlled-input path doesn't drift into a regression.
    render(<Settings />);
    const name = screen.getByLabelText(/name/i) as HTMLInputElement;
    const email = screen.getByLabelText(/email/i) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "Ada Lovelace" } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    expect(name.value).toBe("Ada Lovelace");
    expect(email.value).toBe("ada@example.com");
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

    describe("loading-state decoupling", () => {
      it("billing finishes loading even while the usage fetch is still pending", async () => {
        // A hanging /users/me/usage must not pin the billing card in
        // "Loading…". Subscription + invoices resolve, billing should
        // unblank; usage card stays in its own "Loading usage…" state.
        vi.mocked(fetchUsageSummary).mockImplementation(
          () => new Promise(() => {}),
        );
        render(<Settings />);
        await waitFor(() => {
          expect(screen.getByText("Free")).toBeDefined();
        });
        // Bare "Loading…" (the billing card's marker) must be gone.
        expect(screen.queryByText(/^Loading…$/)).toBeNull();
        // Usage card is still loading independently.
        expect(screen.getByText(/loading usage/i)).toBeDefined();
      });

      it("usage finishes loading even while the billing fetches are still pending", async () => {
        // A hanging /subscriptions/status must not pin the usage card.
        vi.mocked(fetchSubscriptionStatus).mockImplementation(
          () => new Promise(() => {}),
        );
        vi.mocked(fetchInvoices).mockImplementation(
          () => new Promise(() => {}),
        );
        vi.mocked(fetchUsageSummary).mockResolvedValue({
          tier: "free",
          daily: {
            inputTokens: 1_000,
            outputTokens: 500,
            limits: { inputTokens: 50_000, outputTokens: 25_000 },
          },
          monthly: { inputTokens: 0, outputTokens: 0, limits: null },
          percentUsed: 0.02,
          warningThreshold: 0.8,
        });
        render(<Settings />);
        // Usage card unblanks (daily-allowance copy appears).
        await waitFor(() => {
          expect(screen.getByText(/daily allowance/i)).toBeDefined();
        });
        // Billing card still in its own loading state.
        expect(screen.getByText(/^Loading…$/)).toBeDefined();
      });

      it("falls back to a generic message when the usage rejection is not an Error", async () => {
        // Covers the `reason instanceof Error ? reason.message : "…"`
        // fallback in the usage decoupling. Eden treaty reasons are
        // sometimes plain strings (or response value bags) rather than
        // Error instances, so the fallback path is real, not theoretical.
        vi.mocked(fetchUsageSummary).mockRejectedValue("network glitch");
        render(<Settings />);
        await waitFor(() => {
          expect(screen.getByText(/could not load your usage/i)).toBeDefined();
        });
      });

      it("ignores fetch results that resolve after unmount (no setState-on-unmounted warnings)", async () => {
        // Covers the `if (!cancelled)` guards in both the billing and
        // usage paths. Without the guards a slow fetch that resolves
        // after the user has navigated away would call setState on an
        // unmounted component — defensive code that needs a test.
        let resolveSub: (v: unknown) => void = () => {};
        let resolveUsage: (v: unknown) => void = () => {};
        vi.mocked(fetchSubscriptionStatus).mockImplementation(
          () => new Promise((r) => (resolveSub = r as (v: unknown) => void)),
        );
        vi.mocked(fetchUsageSummary).mockImplementation(
          () => new Promise((r) => (resolveUsage = r as (v: unknown) => void)),
        );

        const { unmount } = render(<Settings />);
        unmount();
        // Resolve the promises after unmount — the cancelled flag should
        // suppress the setState calls. The assertion is just that nothing
        // throws and React doesn't log an "act" warning.
        resolveSub({
          tier: "free",
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        resolveUsage(null);
        // Microtask flush so the .then/.finally chains run.
        await Promise.resolve();
        await Promise.resolve();
      });
    });
  });
});
