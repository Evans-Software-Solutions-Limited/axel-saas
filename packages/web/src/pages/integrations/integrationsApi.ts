import { api } from "@/lib/eden";

export type IntegrationStatus = "connected" | "error" | "revoked" | "pending";

export interface ConnectedIntegration {
  id: string;
  integrationId: string;
  status: IntegrationStatus;
  keyHint: string | null;
  label: string | null;
  connectedAt: string | null;
  lastErrorMessageSafe: string | null;
}

interface ListResponseShape {
  success: boolean;
  integrations: Array<{
    id: string;
    integrationId: string;
    status: IntegrationStatus;
    keyHint: string | null;
    label: string | null;
    connectedAt: string | Date | null;
    lastErrorMessageSafe: string | null;
  }>;
}

function normaliseDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * Returns metadata for every integration the user has interacted with.
 * Integrations the user has never touched are not in this list — the page
 * merges this with the static catalog to render available + connected
 * states together.
 */
export async function fetchIntegrations(): Promise<ConnectedIntegration[]> {
  const response = await api.core.integrations.get();
  if (response.error) {
    throw new Error(`Failed to load integrations (${response.error.status})`);
  }
  const body = response.data as ListResponseShape | null;
  if (!body?.success) {
    throw new Error("Integrations response was not successful");
  }
  return body.integrations.map((row) => ({
    id: row.id,
    integrationId: row.integrationId,
    status: row.status,
    keyHint: row.keyHint,
    label: row.label,
    connectedAt: normaliseDate(row.connectedAt),
    lastErrorMessageSafe: row.lastErrorMessageSafe,
  }));
}

export interface ConnectResult {
  keyHint: string;
  connectedAt: string;
}

/**
 * Submit a credential (API key, bot token, PAT) to connect an integration.
 * Throws on failure so the calling modal can render a banner; never
 * exposes the credential after the call returns.
 */
export async function connectIntegration(
  integrationId: string,
  credential: string,
  label?: string,
): Promise<ConnectResult> {
  const body: { credential: string; label?: string } = { credential };
  if (label !== undefined && label.length > 0) body.label = label;

  const response = await api.core
    .integrations({ integrationId })
    .connect.post(body);

  if (response.error) {
    const errMsg = errorMessageFromResponse(
      response.error,
      "Failed to connect integration",
    );
    throw new Error(errMsg);
  }

  const data = response.data as {
    success: boolean;
    status?: string;
    keyHint?: string;
    connectedAt?: string;
    error?: string;
  } | null;
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to connect integration");
  }
  return {
    keyHint: data.keyHint ?? "",
    connectedAt: data.connectedAt ?? new Date().toISOString(),
  };
}

/**
 * Revoke an existing integration. Backend hard-deletes the credential
 * from the secret store and marks the row revoked.
 */
export async function revokeIntegration(integrationId: string): Promise<void> {
  const response = await api.core.integrations({ integrationId }).revoke.post();

  if (response.error) {
    throw new Error(
      errorMessageFromResponse(
        response.error,
        "Failed to disconnect integration",
      ),
    );
  }

  const data = response.data as { success: boolean; error?: string } | null;
  if (!data?.success) {
    throw new Error(data?.error ?? "Failed to disconnect integration");
  }
}

/**
 * Begin an OAuth flow for an integration. Returns the provider URL the
 * caller should navigate the browser to via `window.location.assign`.
 */
export async function startIntegrationOauth(
  integrationId: string,
  returnPath?: string,
): Promise<{ redirectUrl: string }> {
  const response = await api.core
    .integrations({ integrationId })
    .oauth.start.post(returnPath ? { returnPath } : {});

  if (response.error) {
    throw new Error(
      errorMessageFromResponse(response.error, "Failed to start OAuth flow"),
    );
  }

  const data = response.data as {
    success: boolean;
    redirectUrl?: string;
    error?: string;
  } | null;
  if (!data?.success || !data.redirectUrl) {
    throw new Error(data?.error ?? "Failed to start OAuth flow");
  }
  return { redirectUrl: data.redirectUrl };
}

function errorMessageFromResponse(
  err: { status: number; value?: unknown },
  fallback: string,
): string {
  const value = err.value as { error?: unknown } | null;
  if (value && typeof value.error === "string" && value.error.length > 0) {
    return value.error;
  }
  return `${fallback} (${err.status})`;
}
