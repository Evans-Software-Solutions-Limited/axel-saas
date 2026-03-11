import { beforeEach, describe, expect, it, vi } from "vitest";

type HeadersFactory = () => Promise<Record<string, string>>;

const { treatyMock, getSessionMock } = vi.hoisted(() => ({
  treatyMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

let capturedHeadersFactory: HeadersFactory | undefined;

vi.mock("@elysiajs/eden", () => ({
  treaty: (...args: unknown[]) => {
    treatyMock(...args);
    const config = args[1] as { headers?: HeadersFactory } | undefined;
    capturedHeadersFactory = config?.headers;
    return {};
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

describe("eden api client headers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await import("./eden");
  });

  it("returns empty headers when session token is absent", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
    });

    const headers = await capturedHeadersFactory?.();
    expect(headers).toEqual({});
  });

  it("returns authorization header when session token exists", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token-123",
        },
      },
    });

    const headers = await capturedHeadersFactory?.();
    expect(headers).toEqual({ Authorization: "Bearer token-123" });
  });
});
