import { api } from "@/lib/eden";
import { getErrorMessage, getResponseError } from "./chat/apiHelpers";

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
