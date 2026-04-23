import { useState, useCallback } from "react";
import { createCheckoutSession } from "@/pages/subscribeApi";

export function useCheckoutSelection() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlan = useCallback(async (tierId: string | null) => {
    if (!tierId) {
      // Enterprise — contact us
      window.location.assign("mailto:admin@evans-software-solutions.com");
      return;
    }
    if (tierId === "free") {
      // Free tier — no checkout required; user signs up and is provisioned directly.
      window.location.assign("/signup");
      return;
    }
    setError(null);
    setLoadingTier(tierId);
    try {
      const { url } = await createCheckoutSession(tierId);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
      setLoadingTier(null);
    }
  }, []);

  return { loadingTier, error, handleSelectPlan };
}
