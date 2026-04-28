import { useState, useCallback } from "react";
import {
  createCheckoutSession,
  provisionFreeSilently,
} from "@/pages/subscribeApi";
import { useAuth } from "@/hooks/useAuth";

export function useCheckoutSelection() {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const handleSelectPlan = useCallback(
    async (tierId: string | null) => {
      if (!tierId) {
        // Enterprise — contact us
        window.location.assign("mailto:admin@evans-software-solutions.com");
        return;
      }
      if (tierId === "free") {
        // Free tier — no Stripe checkout. Branch on auth state:
        //   - Authed user clicked Free from inside Subscribe → provision and
        //     go to dashboard (otherwise we'd send them back through /signup).
        //   - Logged-out user clicked Free on Pricing → send through signup.
        if (isAuthenticated) {
          await provisionFreeSilently();
          window.location.assign("/dashboard");
        } else {
          window.location.assign("/signup");
        }
        return;
      }
      setError(null);
      setLoadingTier(tierId);
      try {
        const { url } = await createCheckoutSession(tierId);
        window.location.assign(url);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start checkout",
        );
        setLoadingTier(null);
      }
    },
    [isAuthenticated],
  );

  return { loadingTier, error, handleSelectPlan };
}
