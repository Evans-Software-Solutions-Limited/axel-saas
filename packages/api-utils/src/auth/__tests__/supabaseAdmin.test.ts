import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { deleteAuthUser } from "../supabaseAdmin";

const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

describe("deleteAuthUser", () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  });

  afterEach(() => {
    process.env.SUPABASE_URL = ENV.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY;
    vi.restoreAllMocks();
  });

  it("returns success on a 200/204 response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    const result = await deleteAuthUser("user-123", { fetchImpl });

    expect(result.success).toBe(true);
    expect(result.alreadyRemoved).toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://example.supabase.co/auth/v1/admin/users/user-123",
    );
    expect((init as RequestInit).method).toBe("DELETE");
    expect(
      ((init as RequestInit).headers as Record<string, string>).apikey,
    ).toBe("test-service-role");
    expect(
      ((init as RequestInit).headers as Record<string, string>).Authorization,
    ).toBe("Bearer test-service-role");
  });

  it("treats a 404 as already-removed (idempotent)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("not found", { status: 404 }));

    const result = await deleteAuthUser("user-123", { fetchImpl });

    expect(result.success).toBe(true);
    expect(result.alreadyRemoved).toBe(true);
    expect(result.status).toBe(404);
  });

  it("returns failure with body text on a non-404 error response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "server boom" }), {
        status: 500,
      }),
    );

    const result = await deleteAuthUser("user-123", { fetchImpl });

    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain("server boom");
  });

  it("returns failure when the network call rejects", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));

    const result = await deleteAuthUser("user-123", { fetchImpl });

    expect(result.success).toBe(false);
    expect(result.error).toBe("network down");
  });

  it("returns failure when SUPABASE_URL is missing", async () => {
    delete process.env.SUPABASE_URL;
    const fetchImpl = vi.fn();

    const result = await deleteAuthUser("user-123", { fetchImpl });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SUPABASE_URL");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns failure when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchImpl = vi.fn();

    const result = await deleteAuthUser("user-123", { fetchImpl });

    expect(result.success).toBe(false);
    expect(result.error).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("URL-encodes the user id", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteAuthUser("user with spaces/and slashes", { fetchImpl });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://example.supabase.co/auth/v1/admin/users/user%20with%20spaces%2Fand%20slashes",
    );
  });

  it("strips a trailing slash on SUPABASE_URL", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co/";
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteAuthUser("user-123", { fetchImpl });

    const [url] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(
      "https://example.supabase.co/auth/v1/admin/users/user-123",
    );
  });
});
