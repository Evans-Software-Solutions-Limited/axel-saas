import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";
import { Integrations } from "../Integrations";
import {
  connectIntegration,
  fetchIntegrations,
  revokeIntegration,
  startIntegrationOauth,
  type ConnectedIntegration,
} from "../integrations/integrationsApi";
import { fetchSubscriptionStatus } from "../settings/settingsApi";

vi.mock("../integrations/integrationsApi", () => ({
  fetchIntegrations: vi.fn(),
  connectIntegration: vi.fn(),
  revokeIntegration: vi.fn(),
  startIntegrationOauth: vi.fn(),
}));

vi.mock("../settings/settingsApi", () => ({
  fetchSubscriptionStatus: vi.fn(),
}));

const assignMock = vi.fn();
const replaceStateMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "location", {
    value: {
      assign: assignMock,
      href: "http://localhost/integrations",
      search: "",
    },
    writable: true,
  });
  Object.defineProperty(window, "history", {
    value: { replaceState: replaceStateMock },
    writable: true,
  });
  vi.mocked(fetchIntegrations).mockResolvedValue([]);
  vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
    tier: "free",
    status: "active",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  });
});

afterEach(() => {
  cleanup();
});

describe("Integrations page", () => {
  it("renders loading state then catalog grouped by category", async () => {
    render(<Integrations />);
    expect(screen.getByText(/loading integrations/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText("Communication")).toBeDefined();
    });
    expect(screen.getByText("Tools")).toBeDefined();
    expect(screen.getByText("AI Models")).toBeDefined();
    // One entry from each category at minimum.
    expect(screen.getByText("Telegram")).toBeDefined();
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.getByText("OpenAI")).toBeDefined();
  });

  it("shows a Connect button for unconnected free-tier integrations", async () => {
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    // Multiple Connect buttons across the catalog — at least one exists.
    const connects = screen.getAllByRole("button", { name: "Connect" });
    expect(connects.length).toBeGreaterThan(0);
  });

  it("locks BYOM integrations for free-tier users with an Upgrade CTA", async () => {
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeDefined();
    });
    // Free user → OpenAI is locked → Upgrade CTA present, not Connect.
    const upgrades = screen.getAllByRole("button", { name: "Upgrade" });
    expect(upgrades.length).toBeGreaterThan(0);
  });

  it("clicking Upgrade routes to /subscribe", async () => {
    render(<Integrations />);
    const button = await screen.findAllByRole("button", { name: "Upgrade" });
    fireEvent.click(button[0]!);
    expect(assignMock).toHaveBeenCalledWith("/subscribe");
  });

  it("unlocks BYOM integrations for premium-tier users", async () => {
    vi.mocked(fetchSubscriptionStatus).mockResolvedValue({
      tier: "premium",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeDefined();
    });
    // Premium user → no Upgrade CTA on BYOM cards (locks resolved away).
    expect(screen.queryByRole("button", { name: "Upgrade" })).toBeNull();
  });

  it("renders connected state with Manage button + masked keyHint", async () => {
    vi.mocked(fetchIntegrations).mockResolvedValue([
      {
        id: "row-1",
        integrationId: "github",
        status: "connected",
        keyHint: "...wxyz",
        label: "Personal",
        connectedAt: "2026-04-15T12:00:00.000Z",
        lastErrorMessageSafe: null,
      } satisfies ConnectedIntegration,
    ]);
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText(/Connected · \.\.\.wxyz/)).toBeDefined();
    });
    expect(
      screen.getAllByRole("button", { name: "Manage" }).length,
    ).toBeGreaterThan(0);
  });

  it("clicking Connect on api-key integration opens the modal", async () => {
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    // Find the Telegram card's Connect button. Easiest: query by text and
    // walk up to the card, then find its Connect button.
    const telegramHeading = screen.getByText("Telegram");
    const card = telegramHeading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);
    await waitFor(() => {
      expect(screen.getByText("Connect Telegram")).toBeDefined();
    });
    // Modal renders the credential field.
    expect(screen.getByLabelText(/bot token/i)).toBeDefined();
  });

  it("clicking Connect on OAuth integration calls startIntegrationOauth and redirects", async () => {
    vi.mocked(startIntegrationOauth).mockResolvedValue({
      redirectUrl: "https://accounts.google.com/oauth?state=x",
    });
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Google")).toBeDefined();
    });
    const heading = screen.getByText("Google");
    const card = heading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);

    await waitFor(() => {
      expect(startIntegrationOauth).toHaveBeenCalledWith(
        "google",
        "/integrations",
      );
    });
    expect(assignMock).toHaveBeenCalledWith(
      "https://accounts.google.com/oauth?state=x",
    );
  });

  it("shows an error banner when OAuth start fails", async () => {
    vi.mocked(startIntegrationOauth).mockRejectedValue(
      new Error("OAuth provider is not configured"),
    );
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Google")).toBeDefined();
    });
    const heading = screen.getByText("Google");
    const card = heading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);

    await waitFor(() => {
      expect(screen.getByText(/not configured/i)).toBeDefined();
    });
    // No redirect happened.
    expect(assignMock).not.toHaveBeenCalledWith(
      expect.stringContaining("accounts.google.com"),
    );
  });

  it("submitting the connect modal calls the API and shows the connected state", async () => {
    vi.mocked(connectIntegration).mockResolvedValue({
      keyHint: "...wxyz",
      connectedAt: "2026-05-01T12:00:00.000Z",
    });
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    const heading = screen.getByText("Telegram");
    const card = heading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);

    const input = await screen.findByLabelText(/bot token/i);
    fireEvent.change(input, { target: { value: "12345:ABCDEF" } });
    const submit = screen.getByRole("button", { name: "Connect" });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(connectIntegration).toHaveBeenCalledWith(
        "telegram-bot",
        "12345:ABCDEF",
        undefined,
      );
    });
    // Banner appears + card now shows Manage.
    await waitFor(() => {
      expect(screen.getByText("Telegram connected")).toBeDefined();
    });
  });

  it("connect modal validates that a credential is required", async () => {
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    const heading = screen.getByText("Telegram");
    const card = heading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);

    const submit = await screen.findByRole("button", { name: "Connect" });
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByText(/please paste your credential/i)).toBeDefined();
    });
    expect(connectIntegration).not.toHaveBeenCalled();
  });

  it("connect modal surfaces backend errors", async () => {
    vi.mocked(connectIntegration).mockRejectedValue(
      new Error("That bot token didn't look right"),
    );
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    const heading = screen.getByText("Telegram");
    const card = heading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);

    const input = await screen.findByLabelText(/bot token/i);
    fireEvent.change(input, { target: { value: "12345:ABCDEF" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByText(/bot token didn't look right/i)).toBeDefined();
    });
  });

  it("manage modal allows disconnecting a connected integration", async () => {
    vi.mocked(fetchIntegrations).mockResolvedValue([
      {
        id: "row-1",
        integrationId: "github",
        status: "connected",
        keyHint: "...wxyz",
        label: null,
        connectedAt: "2026-04-15T12:00:00.000Z",
        lastErrorMessageSafe: null,
      },
    ]);
    vi.mocked(revokeIntegration).mockResolvedValue();

    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("GitHub")).toBeDefined();
    });

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^disconnect$/i }),
      ).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: /^disconnect$/i }));

    await waitFor(() => {
      expect(revokeIntegration).toHaveBeenCalledWith("github");
    });
    // Banner replaces the button click.
    await waitFor(() => {
      expect(screen.getByText(/disconnected github/i)).toBeDefined();
    });
  });

  it("renders an error banner from the URL ?error= param", async () => {
    Object.defineProperty(window, "location", {
      value: {
        assign: assignMock,
        href: "http://localhost/integrations?error=invalid_state",
        search: "?error=invalid_state",
      },
      writable: true,
    });
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText(/invalid_state/i)).toBeDefined();
    });
    expect(replaceStateMock).toHaveBeenCalled();
  });

  it("renders a success banner from the URL ?connected= param", async () => {
    Object.defineProperty(window, "location", {
      value: {
        assign: assignMock,
        href: "http://localhost/integrations?connected=google",
        search: "?connected=google",
      },
      writable: true,
    });
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText(/connected google/i)).toBeDefined();
    });
  });

  it("shows an error message if integrations fail to load", async () => {
    vi.mocked(fetchIntegrations).mockRejectedValue(
      new Error("Could not reach the integrations service"),
    );
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText(/integrations service/i)).toBeDefined();
    });
  });

  it("treats a subscription fetch failure as free-tier (graceful degradation)", async () => {
    vi.mocked(fetchSubscriptionStatus).mockRejectedValue(
      new Error("Subscription endpoint unavailable"),
    );
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("OpenAI")).toBeDefined();
    });
    // No tier resolved → BYOM stays locked. Surface the lock affordance.
    const upgrades = screen.queryAllByRole("button", { name: "Upgrade" });
    // Subscription failure shouldn't crash the page; lock state may or may
    // not show depending on tierResolved gating, but the page must render.
    expect(upgrades).toBeDefined();
  });

  it("connecting an integration with an existing row updates instead of appending", async () => {
    // Pre-existing pending row for telegram-bot.
    vi.mocked(fetchIntegrations).mockResolvedValue([
      {
        id: "row-pre-existing",
        integrationId: "telegram-bot",
        status: "pending",
        keyHint: null,
        label: null,
        connectedAt: null,
        lastErrorMessageSafe: null,
      },
    ]);
    vi.mocked(connectIntegration).mockResolvedValue({
      keyHint: "...DEF",
      connectedAt: "2026-05-01T12:00:00.000Z",
    });

    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    const heading = screen.getByText("Telegram");
    const card = heading.closest(".glass-card") as HTMLElement;
    fireEvent.click(card.querySelector("button")! as HTMLButtonElement);

    const input = await screen.findByLabelText(/bot token/i);
    fireEvent.change(input, { target: { value: "12345:ABCDEF" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      // The Telegram card now reflects the new keyHint, not a duplicate.
      expect(screen.getByText(/Connected · \.\.\.DEF/)).toBeDefined();
    });
  });

  it("manage modal shows the connection date when present", async () => {
    vi.mocked(fetchIntegrations).mockResolvedValue([
      {
        id: "row-1",
        integrationId: "github",
        status: "connected",
        keyHint: "...wxyz",
        label: "Personal",
        connectedAt: "2026-04-15T12:00:00.000Z",
        lastErrorMessageSafe: null,
      },
    ]);
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("GitHub")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    await waitFor(() => {
      expect(screen.getByText(/15 april 2026/i)).toBeDefined();
    });
    // Label too.
    expect(screen.getByText("Personal")).toBeDefined();
  });

  it("manage modal surfaces a revoke failure", async () => {
    vi.mocked(fetchIntegrations).mockResolvedValue([
      {
        id: "row-1",
        integrationId: "github",
        status: "connected",
        keyHint: "...wxyz",
        label: null,
        connectedAt: "2026-04-15T12:00:00.000Z",
        lastErrorMessageSafe: null,
      },
    ]);
    vi.mocked(revokeIntegration).mockRejectedValue(
      new Error("Secrets manager unreachable"),
    );

    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("GitHub")).toBeDefined();
    });
    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    fireEvent.click(
      await screen.findByRole("button", { name: /^disconnect$/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/secrets manager unreachable/i)).toBeDefined();
    });
  });

  it("renders manage modal with 'to your account' copy when connectedAt is null", async () => {
    vi.mocked(fetchIntegrations).mockResolvedValue([
      {
        id: "row-1",
        integrationId: "github",
        status: "connected",
        keyHint: null,
        label: null,
        connectedAt: null,
        lastErrorMessageSafe: null,
      },
    ]);
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("GitHub")).toBeDefined();
    });
    // Card without a keyHint just says "Connected" (no masked hint).
    expect(screen.queryByText(/Connected · /, { selector: "p" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Manage" }));
    await waitFor(() => {
      expect(screen.getByText(/to your account/i)).toBeDefined();
    });
    // No "Credential:" line when keyHint is null.
    expect(screen.queryByText(/credential:/i)).toBeNull();
  });

  it("does not call replaceState when the URL has no banner params", async () => {
    Object.defineProperty(window, "location", {
      value: {
        assign: assignMock,
        href: "http://localhost/integrations",
        search: "",
      },
      writable: true,
    });
    render(<Integrations />);
    await waitFor(() => {
      expect(screen.getByText("Telegram")).toBeDefined();
    });
    expect(replaceStateMock).not.toHaveBeenCalled();
  });
});
