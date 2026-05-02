import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectIntegration,
  fetchIntegrations,
  revokeIntegration,
  startIntegrationOauth,
} from "./integrationsApi";

const { mockApi } = vi.hoisted(() => {
  const integrationFn = vi.fn();
  return {
    mockApi: {
      core: {
        integrations: Object.assign(integrationFn, {
          get: vi.fn(),
        }),
      },
    },
  };
});

vi.mock("@/lib/eden", () => ({
  api: mockApi,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchIntegrations", () => {
  it("returns connected integrations on success", async () => {
    mockApi.core.integrations.get.mockResolvedValue({
      data: {
        success: true,
        integrations: [
          {
            id: "row-1",
            integrationId: "openai",
            status: "connected",
            keyHint: "...abcd",
            label: "Production",
            connectedAt: "2026-04-15T12:00:00.000Z",
            lastErrorMessageSafe: null,
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchIntegrations();
    expect(result).toHaveLength(1);
    expect(result[0]?.integrationId).toBe("openai");
    expect(result[0]?.keyHint).toBe("...abcd");
    expect(result[0]?.connectedAt).toBe("2026-04-15T12:00:00.000Z");
  });

  it("normalises Date connectedAt to an ISO string", async () => {
    mockApi.core.integrations.get.mockResolvedValue({
      data: {
        success: true,
        integrations: [
          {
            id: "row-1",
            integrationId: "github",
            status: "connected",
            keyHint: null,
            label: null,
            connectedAt: new Date("2026-04-15T12:00:00.000Z"),
            lastErrorMessageSafe: null,
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchIntegrations();
    expect(result[0]?.connectedAt).toBe("2026-04-15T12:00:00.000Z");
  });

  it("returns null connectedAt when missing", async () => {
    mockApi.core.integrations.get.mockResolvedValue({
      data: {
        success: true,
        integrations: [
          {
            id: "row-1",
            integrationId: "github",
            status: "pending",
            keyHint: null,
            label: null,
            connectedAt: null,
            lastErrorMessageSafe: null,
          },
        ],
      },
      error: null,
    } as never);

    const result = await fetchIntegrations();
    expect(result[0]?.connectedAt).toBeNull();
  });

  it("throws when Eden returns response.error", async () => {
    mockApi.core.integrations.get.mockResolvedValue({
      data: null,
      error: { status: 500, value: { error: "boom" } },
    } as never);

    await expect(fetchIntegrations()).rejects.toThrow(/500/);
  });

  it("throws when body says success: false", async () => {
    mockApi.core.integrations.get.mockResolvedValue({
      data: { success: false, integrations: [] },
      error: null,
    } as never);

    await expect(fetchIntegrations()).rejects.toThrow(/not successful/i);
  });
});

describe("connectIntegration", () => {
  function setupConnect(response: unknown) {
    const post = vi.fn().mockResolvedValue(response as never);
    mockApi.core.integrations.mockReturnValue({
      connect: { post },
    });
    return post;
  }

  it("posts credential to the path-param route", async () => {
    const post = setupConnect({
      data: {
        success: true,
        status: "connected",
        keyHint: "...abcd",
        connectedAt: "2026-04-15T12:00:00.000Z",
      },
      error: null,
    });

    const result = await connectIntegration("openai", "sk-secret-key", "Prod");

    expect(mockApi.core.integrations).toHaveBeenCalledWith({
      integrationId: "openai",
    });
    expect(post).toHaveBeenCalledWith({
      credential: "sk-secret-key",
      label: "Prod",
    });
    expect(result.keyHint).toBe("...abcd");
    expect(result.connectedAt).toBe("2026-04-15T12:00:00.000Z");
  });

  it("omits empty label", async () => {
    const post = setupConnect({
      data: { success: true, keyHint: "x", connectedAt: "2026-01-01" },
      error: null,
    });
    await connectIntegration("openai", "sk-secret-key", "");
    expect(post).toHaveBeenCalledWith({ credential: "sk-secret-key" });
  });

  it("uses backend error message when present", async () => {
    setupConnect({
      data: null,
      error: {
        status: 403,
        value: { error: "This integration requires a Premium subscription" },
      },
    });

    await expect(connectIntegration("openai", "sk-secret-key")).rejects.toThrow(
      /Premium subscription/,
    );
  });

  it("falls back to default error when no message provided", async () => {
    setupConnect({ data: null, error: { status: 500, value: null } });

    await expect(connectIntegration("openai", "sk-secret-key")).rejects.toThrow(
      /Failed to connect integration \(500\)/,
    );
  });

  it("throws when body says success: false", async () => {
    setupConnect({
      data: { success: false, error: "Invalid integration ID" },
      error: null,
    });
    await expect(connectIntegration("nope", "x")).rejects.toThrow(
      /Invalid integration ID/,
    );
  });
});

describe("revokeIntegration", () => {
  function setupRevoke(response: unknown) {
    const post = vi.fn().mockResolvedValue(response as never);
    mockApi.core.integrations.mockReturnValue({
      revoke: { post },
    });
    return post;
  }

  it("posts to the revoke path", async () => {
    const post = setupRevoke({
      data: { success: true, status: "revoked" },
      error: null,
    });
    await revokeIntegration("openai");
    expect(mockApi.core.integrations).toHaveBeenCalledWith({
      integrationId: "openai",
    });
    expect(post).toHaveBeenCalledWith();
  });

  it("throws on response.error", async () => {
    setupRevoke({
      data: null,
      error: { status: 404, value: { error: "Integration not found" } },
    });
    await expect(revokeIntegration("openai")).rejects.toThrow(
      /Integration not found/,
    );
  });

  it("throws when body says success: false", async () => {
    setupRevoke({
      data: { success: false, error: "Already revoked" },
      error: null,
    });
    await expect(revokeIntegration("openai")).rejects.toThrow(
      /Already revoked/,
    );
  });

  it("falls back to a default error when response.data is null", async () => {
    setupRevoke({ data: null, error: null });
    await expect(revokeIntegration("openai")).rejects.toThrow(
      /Failed to disconnect integration/,
    );
  });
});

describe("startIntegrationOauth", () => {
  function setupStart(response: unknown) {
    const post = vi.fn().mockResolvedValue(response as never);
    mockApi.core.integrations.mockReturnValue({
      oauth: { start: { post } },
    });
    return post;
  }

  it("returns redirectUrl on success", async () => {
    setupStart({
      data: {
        success: true,
        redirectUrl: "https://accounts.google.com/oauth?state=x",
      },
      error: null,
    });

    const result = await startIntegrationOauth("google", "/integrations");
    expect(result.redirectUrl).toBe(
      "https://accounts.google.com/oauth?state=x",
    );
  });

  it("forwards the returnPath in the body", async () => {
    const post = setupStart({
      data: { success: true, redirectUrl: "https://x" },
      error: null,
    });
    await startIntegrationOauth("google", "/integrations");
    expect(post).toHaveBeenCalledWith({ returnPath: "/integrations" });
  });

  it("sends an empty body when no returnPath", async () => {
    const post = setupStart({
      data: { success: true, redirectUrl: "https://x" },
      error: null,
    });
    await startIntegrationOauth("google");
    expect(post).toHaveBeenCalledWith({});
  });

  it("throws on response.error", async () => {
    setupStart({
      data: null,
      error: {
        status: 400,
        value: { error: "OAuth provider is not configured" },
      },
    });
    await expect(startIntegrationOauth("google")).rejects.toThrow(
      /not configured/,
    );
  });

  it("throws when redirectUrl missing", async () => {
    setupStart({ data: { success: true }, error: null });
    await expect(startIntegrationOauth("google")).rejects.toThrow(
      /Failed to start OAuth flow/,
    );
  });

  it("falls back to a default error when response.data is null", async () => {
    setupStart({ data: null, error: null });
    await expect(startIntegrationOauth("google")).rejects.toThrow(
      /Failed to start OAuth flow/,
    );
  });

  it("falls back to default error message when error.value is non-string", async () => {
    setupStart({ data: null, error: { status: 400, value: { error: 42 } } });
    await expect(startIntegrationOauth("google")).rejects.toThrow(/\(400\)/);
  });
});
