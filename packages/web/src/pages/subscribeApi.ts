import { api } from "@/lib/eden";
import { getErrorMessage, getResponseError } from "./chat/apiHelpers";

/**
 * Best-effort free-tier provisioning. Idempotent on the backend — calling
 * twice for the same user returns the existing row unchanged.
 *
 * Never throws. Eden treaty resolves `{ data, error }` for HTTP failures
 * (including the 401 you get when the Supabase session isn't established
 * yet during the email-confirmation flow); genuine network throws are
 * caught separately. Both paths log a warning and return — provisioning
 * will retry on the next authed touch.
 */
export async function provisionFreeSilently(): Promise<void> {
  try {
    const response = await api.core.subscriptions.free.post();
    if (response.error) {
      console.warn("[free-tier] provisioning deferred:", response.error);
    }
  } catch (err) {
    console.warn("[free-tier] provisioning deferred:", err);
  }
}

export async function createCheckoutSession(
  tier: string,
): Promise<{ url: string }> {
  const response = await api.core.stripe["create-checkout-session"].post({
    tier,
  });
  const data = response.data;

  if (
    data &&
    "url" in data &&
    typeof (data as { url: unknown }).url === "string"
  ) {
    return { url: (data as { url: string }).url };
  }

  const errorMessage =
    getResponseError(response)?.message ??
    getErrorMessage(getResponseError(response)?.value) ??
    "Failed to create checkout session";

  throw new Error(errorMessage);
}
