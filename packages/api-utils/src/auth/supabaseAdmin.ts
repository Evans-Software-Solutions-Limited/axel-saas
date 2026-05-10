/**
 * Thin admin client for Supabase auth — used by the account-deletion
 * flow to remove the corresponding `auth.users` row after the
 * application-side cascade has run.
 *
 * Implemented as a fetch wrapper rather than via `@supabase/supabase-js`
 * so the core Lambda doesn't pull a 200 KB SDK in just to call one
 * REST endpoint. The service-role key is mandatory and never falls back
 * to the anon key — the admin endpoints will silently no-op with anon.
 */

const ADMIN_USERS_PATH = "/auth/v1/admin/users";

export interface DeleteAuthUserResult {
  success: boolean;
  /** Treated like success by the caller — Supabase returns 404 when the
   * row was already removed (e.g. retry of a partially-completed
   * deletion). The caller is expected to be idempotent on this path. */
  alreadyRemoved?: boolean;
  status?: number;
  error?: string;
}

interface SupabaseAdminConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchImpl?: typeof fetch;
}

function readConfig(): SupabaseAdminConfig | { error: string } {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    return { error: "SUPABASE_URL is not set" };
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey };
}

/**
 * Delete a user from Supabase auth by their auth-user UUID.
 *
 * Idempotent: a 404 is reported as `alreadyRemoved: true` rather than an
 * error, so retrying a partially-completed delete (e.g. app-side cascade
 * succeeded, auth call failed once, retry follows) still resolves cleanly.
 */
export async function deleteAuthUser(
  supabaseUserId: string,
  config?: Partial<SupabaseAdminConfig>,
): Promise<DeleteAuthUserResult> {
  const fromEnv = readConfig();
  if ("error" in fromEnv) {
    return { success: false, error: fromEnv.error };
  }
  const supabaseUrl = config?.supabaseUrl ?? fromEnv.supabaseUrl;
  const serviceRoleKey = config?.serviceRoleKey ?? fromEnv.serviceRoleKey;
  const fetchImpl = config?.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await fetchImpl(
      `${supabaseUrl}${ADMIN_USERS_PATH}/${encodeURIComponent(supabaseUserId)}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  if (response.ok) {
    return { success: true, status: response.status };
  }
  if (response.status === 404) {
    return { success: true, alreadyRemoved: true, status: 404 };
  }
  let body = "";
  try {
    body = await response.text();
  } catch {
    // ignore
  }
  return {
    success: false,
    status: response.status,
    error: body || `Supabase admin API returned ${response.status}`,
  };
}
