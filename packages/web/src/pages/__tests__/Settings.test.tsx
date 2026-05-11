import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { Settings } from "../Settings";
import {
  deleteAccount,
  fetchInvoices,
  fetchSubscriptionStatus,
  fetchUserProfile,
  openCustomerPortal,
  updateNotificationPreferences,
  updateProfileName,
  type InvoiceSummary,
  type NotificationPreferences,
  type SubscriptionInfo,
  type UserProfile,
} from "../settings/settingsApi";
import { fetchUsageSummary } from "../usage/usageApi";
import { useAuth } from "@/hooks/useAuth";

vi.mock("../settings/settingsApi", () => ({
  fetchSubscriptionStatus: vi.fn(),
  fetchInvoices: vi.fn(),
  openCustomerPortal: vi.fn(),
  fetchUserProfile: vi.fn(),
  updateProfileName: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("../usage/usageApi", () => ({
  fetchUsageSummary: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));

const assignMock = vi.fn();
const signOutMock = vi.fn();

const PROFILE: UserProfile = {
  id: "u1",
  email: "user@example.com",
  fullName: "John Doe",
  onboardingCompleted: true,
  notificationPreferences: { emailNotifications: true, weeklyDigest: true },
};

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
  vi.mocked(fetchUsageSummary).mockResolvedValue(null);
  vi.mocked(fetchUserProfile).mockResolvedValue(PROFILE);
  signOutMock.mockResolvedValue({ success: true });
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: true,
    signOut: signOutMock,
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(() => {
  cleanup();
});

describe("Settings", () => {
  it("renders profile, notifications and billing sections", async () => {
    render(<Settings />);
    expect(screen.getByText("Profile")).toBeDefined();
    expect(screen.getByText("Notifications")).toBeDefined();
    expect(screen.getByText("Billing")).toBeDefined();
    expect(screen.getByText("Danger Zone")).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText("Free")).toBeDefined();
    });
  });

  describe("profile section", () => {
    it("seeds the editable name from /users/me and disables Save until dirty", async () => {
      render(<Settings />);
      const nameInput = (await screen.findByLabelText(
        /^name$/i,
      )) as HTMLInputElement;
      expect(nameInput.value).toBe("John Doe");

      const save = screen.getByRole("button", { name: /save changes/i });
      expect(save).toHaveProperty("disabled", true);

      fireEvent.change(nameInput, { target: { value: "Ada Lovelace" } });
      expect(save).toHaveProperty("disabled", false);
    });

    it("renders the email field as read-only", async () => {
      render(<Settings />);
      const emailInput = (await screen.findByLabelText(
        /^email$/i,
      )) as HTMLInputElement;
      expect(emailInput.value).toBe("user@example.com");
      expect(emailInput.readOnly).toBe(true);
    });

    it("saves the trimmed name and shows a success indicator", async () => {
      vi.mocked(updateProfileName).mockResolvedValue({
        ...PROFILE,
        fullName: "Ada Lovelace",
      });
      render(<Settings />);
      const nameInput = (await screen.findByLabelText(
        /^name$/i,
      )) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "  Ada Lovelace  " } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(updateProfileName).toHaveBeenCalledWith("Ada Lovelace");
      });
      await waitFor(() => {
        expect(screen.getByText(/^Saved$/)).toBeDefined();
      });
    });

    it("shows a save error and keeps the input editable on failure", async () => {
      vi.mocked(updateProfileName).mockRejectedValue(
        new Error("Failed to save profile (500)"),
      );
      render(<Settings />);
      const nameInput = (await screen.findByLabelText(
        /^name$/i,
      )) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Ada" } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(screen.getByText(/failed to save profile/i)).toBeDefined();
      });
      const saveButton = screen.getByRole("button", {
        name: /save changes/i,
      }) as HTMLButtonElement;
      expect(saveButton.disabled).toBe(false);
    });

    it("shows a load error when fetchUserProfile rejects", async () => {
      // The profile fetch backs the Profile, Notifications AND Danger
      // Zone sections — a single failure renders the same error message
      // in all three. getAllByText keeps the assertion truthful.
      vi.mocked(fetchUserProfile).mockRejectedValue(
        new Error("Profile endpoint unavailable"),
      );
      render(<Settings />);
      await waitFor(() => {
        expect(
          screen.getAllByText(/profile endpoint unavailable/i).length,
        ).toBeGreaterThan(0);
      });
      // Billing still renders independently — the profile failure must
      // not pin the billing card.
      expect(screen.getByText("Free")).toBeDefined();
    });

    it("falls back to a generic message when the profile rejection is not an Error", async () => {
      // Eden treaty rejections are sometimes plain strings — the
      // `reason instanceof Error` fallback in Settings.tsx only fires
      // when the rejection is a non-Error value.
      vi.mocked(fetchUserProfile).mockRejectedValue("network glitch");
      render(<Settings />);
      await waitFor(() => {
        expect(
          screen.getAllByText(/could not load your profile/i).length,
        ).toBeGreaterThan(0);
      });
    });

    it("clears stale save feedback as soon as the user keeps typing", async () => {
      vi.mocked(updateProfileName).mockRejectedValueOnce(
        new Error("Failed to save profile (500)"),
      );
      render(<Settings />);
      const nameInput = (await screen.findByLabelText(
        /^name$/i,
      )) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Ada" } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      await waitFor(() => {
        expect(screen.getByText(/failed to save profile/i)).toBeDefined();
      });

      // Typing more characters clears the stale error message.
      fireEvent.change(nameInput, { target: { value: "Ada L" } });
      expect(screen.queryByText(/failed to save profile/i)).toBeNull();
    });

    it("keeps Save disabled when the trimmed name is empty even if the input has whitespace", async () => {
      render(<Settings />);
      const nameInput = (await screen.findByLabelText(
        /^name$/i,
      )) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "    " } });
      const save = screen.getByRole("button", {
        name: /save changes/i,
      }) as HTMLButtonElement;
      expect(save.disabled).toBe(true);
    });

    it("falls back to a generic save-error message when the rejection is not an Error", async () => {
      vi.mocked(updateProfileName).mockRejectedValue("boom");
      render(<Settings />);
      const nameInput = (await screen.findByLabelText(
        /^name$/i,
      )) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: "Ada" } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
      await waitFor(() => {
        expect(screen.getByText(/could not save your changes/i)).toBeDefined();
      });
    });
  });

  describe("notifications section", () => {
    it("renders both toggles in their loaded state", async () => {
      vi.mocked(fetchUserProfile).mockResolvedValue({
        ...PROFILE,
        notificationPreferences: {
          emailNotifications: false,
          weeklyDigest: true,
        },
      });
      render(<Settings />);
      const toggles = await screen.findAllByRole("switch");
      // [emailNotifications, weeklyDigest]
      expect(toggles).toHaveLength(2);
      expect(toggles[0]?.getAttribute("aria-checked")).toBe("false");
      expect(toggles[1]?.getAttribute("aria-checked")).toBe("true");
    });

    it("optimistically flips a toggle and persists the change", async () => {
      vi.mocked(updateNotificationPreferences).mockResolvedValue({
        emailNotifications: false,
        weeklyDigest: true,
      } satisfies NotificationPreferences);

      render(<Settings />);
      const [emailToggle] = await screen.findAllByRole("switch");
      fireEvent.click(emailToggle!);

      // Optimistic update: aria-checked flips before the network resolves.
      expect(emailToggle?.getAttribute("aria-checked")).toBe("false");
      await waitFor(() => {
        expect(updateNotificationPreferences).toHaveBeenCalledWith({
          emailNotifications: false,
        });
      });
    });

    it("rolls back the optimistic toggle on failure and shows an error", async () => {
      vi.mocked(updateNotificationPreferences).mockRejectedValue(
        new Error("Could not update your preferences"),
      );
      render(<Settings />);
      const [emailToggle] = await screen.findAllByRole("switch");
      fireEvent.click(emailToggle!);

      await waitFor(() => {
        expect(
          screen.getByText(/could not update your preferences/i),
        ).toBeDefined();
      });
      // Rolled back to the original `true` state.
      expect(emailToggle?.getAttribute("aria-checked")).toBe("true");
    });

    it("falls back to a generic error message when the rejection is not an Error", async () => {
      vi.mocked(updateNotificationPreferences).mockRejectedValue("boom");
      render(<Settings />);
      const [emailToggle] = await screen.findAllByRole("switch");
      fireEvent.click(emailToggle!);
      await waitFor(() => {
        expect(
          screen.getByText(/could not update your preferences/i),
        ).toBeDefined();
      });
    });

    it("flips the second toggle (weeklyDigest) and persists it", async () => {
      vi.mocked(updateNotificationPreferences).mockResolvedValue({
        emailNotifications: true,
        weeklyDigest: false,
      } satisfies NotificationPreferences);

      render(<Settings />);
      const toggles = await screen.findAllByRole("switch");
      const weeklyDigestToggle = toggles[1]!;
      fireEvent.click(weeklyDigestToggle);

      await waitFor(() => {
        expect(updateNotificationPreferences).toHaveBeenCalledWith({
          weeklyDigest: false,
        });
      });
    });

    it("disables BOTH toggles while a save is in flight (UI matches handleToggle's any-save guard)", async () => {
      // Bugbot regression: each toggle's `disabled` used to match only
      // its own key (`saving === "emailNotifications"`), but
      // `handleToggle` early-returns on any in-flight save. The
      // non-saving toggle looked clickable, accepted the click, and
      // silently no-op'd. Now both toggles flip to disabled together.
      let resolveSave: (value: NotificationPreferences) => void = () => {};
      vi.mocked(updateNotificationPreferences).mockImplementation(
        () =>
          new Promise<NotificationPreferences>((r) => {
            resolveSave = r;
          }),
      );

      render(<Settings />);
      const toggles = await screen.findAllByRole("switch");
      const [emailToggle, weeklyDigestToggle] = toggles;
      fireEvent.click(emailToggle!);

      // While email is saving, both toggles should report disabled —
      // the cursor / opacity must match the handler's behaviour.
      await waitFor(() => {
        expect(emailToggle).toHaveProperty("disabled", true);
      });
      expect(weeklyDigestToggle).toHaveProperty("disabled", true);

      // Resolve the save — both come back enabled.
      resolveSave({ emailNotifications: false, weeklyDigest: true });
      await waitFor(() => {
        expect(emailToggle).toHaveProperty("disabled", false);
      });
      expect(weeklyDigestToggle).toHaveProperty("disabled", false);
    });
  });

  describe("danger zone", () => {
    it("hides the trigger button while the profile is still loading", () => {
      vi.mocked(fetchUserProfile).mockImplementation(
        () => new Promise(() => {}),
      );
      render(<Settings />);
      // Multiple "Loading…" markers exist; danger-zone renders a
      // Loading… line of its own. The Delete trigger should be absent.
      expect(
        screen.queryByRole("button", { name: /delete account/i }),
      ).toBeNull();
    });

    it("renders an inline error and hides the trigger when the profile failed to load", async () => {
      vi.mocked(fetchUserProfile).mockRejectedValue(
        new Error("Profile endpoint unavailable"),
      );
      render(<Settings />);
      // The Danger Zone's body still renders the section copy with the
      // error inline — but the trigger button is suppressed so the user
      // can't enter a delete flow we can't safely complete.
      await waitFor(() => {
        expect(
          screen.getAllByText(/profile endpoint unavailable/i).length,
        ).toBeGreaterThan(0);
      });
      expect(
        screen.queryByRole("button", { name: /delete account/i }),
      ).toBeNull();
    });

    // Helper: open the dialog and return its scoped queries. The dialog
    // is portaled out of the Settings root, but `screen` searches
    // document.body so a `role="dialog"` lookup is enough to scope.
    const openDeleteDialog = async () => {
      const trigger = await screen.findByRole("button", {
        name: /delete account/i,
      });
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("dialog");
      return within(dialog);
    };

    it("opens a typed-confirmation modal on click", async () => {
      render(<Settings />);
      const dialog = await openDeleteDialog();
      expect(dialog.getByText(/type your email address/i)).toBeDefined();
      // Confirm button is disabled until the user types the exact email.
      const confirmButton = dialog.getByRole("button", {
        name: /delete account/i,
      }) as HTMLButtonElement;
      expect(confirmButton.disabled).toBe(true);
    });

    it("enables the confirm button only when the typed email matches exactly", async () => {
      render(<Settings />);
      const dialog = await openDeleteDialog();

      const input = dialog.getByLabelText(
        /type .* to confirm/i,
      ) as HTMLInputElement;
      const confirm = () =>
        dialog.getByRole("button", {
          name: /delete account/i,
        }) as HTMLButtonElement;

      fireEvent.change(input, { target: { value: "user@example.co" } });
      expect(confirm().disabled).toBe(true);

      fireEvent.change(input, { target: { value: "user@example.com" } });
      expect(confirm().disabled).toBe(false);
    });

    it("calls deleteAccount and signs the user out on success", async () => {
      vi.mocked(deleteAccount).mockResolvedValue();
      render(<Settings />);
      const dialog = await openDeleteDialog();
      const input = dialog.getByLabelText(
        /type .* to confirm/i,
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "user@example.com" } });
      fireEvent.click(dialog.getByRole("button", { name: /delete account/i }));

      await waitFor(() => {
        expect(deleteAccount).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalled();
      });
    });

    it("falls back to a hard redirect when signOut fails after a successful delete", async () => {
      vi.mocked(deleteAccount).mockResolvedValue();
      signOutMock.mockResolvedValue({ success: false, error: "session gone" });
      render(<Settings />);
      const dialog = await openDeleteDialog();
      const input = dialog.getByLabelText(
        /type .* to confirm/i,
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "user@example.com" } });
      fireEvent.click(dialog.getByRole("button", { name: /delete account/i }));

      await waitFor(() => {
        expect(assignMock).toHaveBeenCalledWith("/");
      });
    });

    it("falls back to a hard redirect when signOut THROWS after a successful delete", async () => {
      // Bugbot regression: a thrown error (vs. a `{ success: false }`
      // return) used to bubble back into the dialog's combined try/catch,
      // which set an "Account deletion failed" message on an already-
      // closed dialog and never redirected. The user was stranded on a
      // Settings page tied to a now-missing account, with a stale client
      // session and an invisible (and misleading) error.
      vi.mocked(deleteAccount).mockResolvedValue();
      signOutMock.mockRejectedValue(new Error("network down"));
      render(<Settings />);
      const dialog = await openDeleteDialog();
      const input = dialog.getByLabelText(
        /type .* to confirm/i,
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "user@example.com" } });
      fireEvent.click(dialog.getByRole("button", { name: /delete account/i }));

      await waitFor(() => {
        expect(assignMock).toHaveBeenCalledWith("/");
      });
      // No misleading "Account deletion failed" message — the deletion
      // actually succeeded.
      expect(screen.queryByText(/account deletion failed/i)).toBeNull();
    });

    it("closes the modal and resets state when Cancel is clicked", async () => {
      render(<Settings />);
      const dialog = await openDeleteDialog();
      const input = dialog.getByLabelText(
        /type .* to confirm/i,
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "user@example.com" } });

      // Confirm button is enabled at this point.
      expect(
        (
          dialog.getByRole("button", {
            name: /delete account/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);

      // Cancel — the modal closes and the typed confirmation should be
      // cleared so re-opening the dialog starts from a clean slate.
      fireEvent.click(dialog.getByRole("button", { name: /^cancel$/i }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });

      // Re-open and the confirm button is disabled again (state was reset).
      const dialog2 = await openDeleteDialog();
      expect(
        (
          dialog2.getByRole("button", {
            name: /delete account/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
    });

    it("falls back to a generic error message when the rejection is not an Error", async () => {
      vi.mocked(deleteAccount).mockRejectedValue("boom");
      render(<Settings />);
      const dialog = await openDeleteDialog();
      fireEvent.change(dialog.getByLabelText(/type .* to confirm/i), {
        target: { value: "user@example.com" },
      });
      fireEvent.click(dialog.getByRole("button", { name: /delete account/i }));
      await waitFor(() => {
        expect(dialog.getByText(/account deletion failed/i)).toBeDefined();
      });
    });

    it("shows a server-side error and keeps the modal open on failure", async () => {
      vi.mocked(deleteAccount).mockRejectedValue(
        new Error(
          "We couldn't cancel your subscription with our payment provider. Please try again in a moment.",
        ),
      );
      render(<Settings />);
      const dialog = await openDeleteDialog();
      const input = dialog.getByLabelText(
        /type .* to confirm/i,
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "user@example.com" } });
      fireEvent.click(dialog.getByRole("button", { name: /delete account/i }));

      await waitFor(() => {
        expect(dialog.getByText(/payment provider/i)).toBeDefined();
      });
      // Sign-out must NOT have fired — the user still has an account.
      expect(signOutMock).not.toHaveBeenCalled();
    });
  });

  describe("billing", () => {
    it("shows a loading state before the subscription resolves", () => {
      vi.mocked(fetchSubscriptionStatus).mockImplementation(
        () => new Promise(() => {}),
      );
      render(<Settings />);
      // The billing card's bare "Loading…" marker. Profile, Notifications
      // and Danger Zone now render their own loading copy ("Loading
      // profile…", "Loading preferences…", a panel-level "Loading…")
      // — the regex matches any of them, so use a more specific anchor.
      expect(screen.getAllByText(/^Loading…$/).length).toBeGreaterThan(0);
    });

    it("shows an error message when the subscription fetch fails", async () => {
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
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(fetchInvoices).mockRejectedValue(new Error("Stripe is down"));

      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /cancel plan/i }),
      ).toBeDefined();
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

    it("renders an unpaid invoice without a hosted URL using the fallback styles and dash placeholder", async () => {
      // Covers the non-"paid" badge branch, the `inv.status ?? "unknown"`
      // fallback, and the missing-hostedInvoiceUrl em-dash placeholder.
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: "2026-05-15T00:00:00.000Z",
        cancelAtPeriodEnd: false,
      });
      vi.mocked(fetchInvoices).mockResolvedValue([
        {
          id: "inv_unpaid",
          number: null,
          status: null,
          amountPaid: 0,
          currency: "gbp",
          created: 1715731200,
          hostedInvoiceUrl: null,
          invoicePdf: null,
          periodStart: 1713139200,
          periodEnd: 1715731200,
        } satisfies InvoiceSummary,
      ]);

      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText(/recent invoices/i)).toBeDefined();
      });
      expect(screen.getByText("unknown")).toBeDefined();
      expect(screen.getByText("—")).toBeDefined();
      expect(screen.queryByRole("link", { name: /^view$/i })).toBeNull();
    });

    it("renders 'Cancellation scheduled' without a date when currentPeriodEnd is missing", async () => {
      // Covers the `renewal ? ... : "Cancellation scheduled"` fallback —
      // a portal cancellation can land before we know the end date.
      vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
        tier: "premium",
        status: "active",
        currentPeriodEnd: null,
        cancelAtPeriodEnd: true,
      });
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText("Premium")).toBeDefined();
      });
      expect(screen.getByText(/^Cancellation scheduled$/)).toBeDefined();
      expect(screen.queryByText(/active until/i)).toBeNull();
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
          created: 1715731200,
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
      expect(
        (
          screen.getByRole("button", {
            name: /manage subscription/i,
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });

    it("renders the cancelled-premium state with Manage billing only and no contradictory copy", async () => {
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
      expect(
        screen.getByText(/please update your payment method/i),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /cancel plan/i }),
      ).toBeDefined();
    });

    it("renders 'Cancellation scheduled' (not 'Renews') when cancelAtPeriodEnd is true", async () => {
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

      expect(
        screen.getByRole("button", { name: /manage subscription/i }),
      ).toBeDefined();
      expect(screen.queryByRole("button", { name: /cancel plan/i })).toBeNull();
    });

    it("renders the Enterprise tier without billing actions and without an invoices section", async () => {
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
      expect(screen.getByText(/^Usage$/)).toBeDefined();
      await waitFor(() => {
        expect(screen.getByText(/daily allowance/i)).toBeDefined();
      });
      expect(screen.getByText(/25\.0k \/ 50\.0k/)).toBeDefined();
    });

    it("renders the inline error when fetchUsageSummary rejects", async () => {
      vi.mocked(fetchUsageSummary).mockRejectedValue(
        new Error("Usage endpoint unavailable"),
      );
      render(<Settings />);
      await waitFor(() => {
        expect(screen.getByText(/usage endpoint unavailable/i)).toBeDefined();
      });
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
        vi.mocked(fetchUsageSummary).mockImplementation(
          () => new Promise(() => {}),
        );
        render(<Settings />);
        await waitFor(() => {
          expect(screen.getByText("Free")).toBeDefined();
        });
        expect(screen.getByText(/loading usage/i)).toBeDefined();
      });

      it("usage finishes loading even while the billing fetches are still pending", async () => {
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
        await waitFor(() => {
          expect(screen.getByText(/daily allowance/i)).toBeDefined();
        });
        expect(screen.getAllByText(/^Loading…$/).length).toBeGreaterThan(0);
      });

      it("falls back to a generic message when the usage rejection is not an Error", async () => {
        vi.mocked(fetchUsageSummary).mockRejectedValue("network glitch");
        render(<Settings />);
        await waitFor(() => {
          expect(screen.getByText(/could not load your usage/i)).toBeDefined();
        });
      });

      it("ignores fetch results that resolve after unmount (no setState-on-unmounted warnings)", async () => {
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
        resolveSub({
          tier: "free",
          status: "active",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
        });
        resolveUsage(null);
        await Promise.resolve();
        await Promise.resolve();
      });
    });
  });
});
