import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { MarketingLayout } from "@/components/MarketingLayout";
import { unsubscribeWaitlist } from "@/lib/waitlistApi";

const MISSING_TOKEN_MSG =
  "Missing token. Open the unsubscribe link from your email.";

export function WaitlistUnsubscribe() {
  const [params] = useSearchParams();
  const token = (params.get("token") ?? "").trim();
  const hasValidToken = token.length > 0;

  const [phase, setPhase] = useState<"loading" | "ok" | "err">(() =>
    hasValidToken ? "loading" : "err",
  );
  const [errMsg, setErrMsg] = useState(() =>
    hasValidToken ? "" : MISSING_TOKEN_MSG,
  );

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    void unsubscribeWaitlist(token).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setPhase("ok");
      } else {
        setPhase("err");
        setErrMsg(res.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <MarketingLayout>
      <section className="py-24 px-4 text-center">
        <div className="max-w-md mx-auto space-y-4">
          {phase === "loading" && (
            <p className="text-muted">Removing you from the list…</p>
          )}
          {phase === "ok" && (
            <>
              <h1 className="text-2xl font-bold text-text">
                You&apos;re off the list
              </h1>
              <p className="text-muted">
                You won&apos;t receive further waitlist emails at this address.
              </p>
            </>
          )}
          {phase === "err" && (
            <>
              <h1 className="text-2xl font-bold text-text">
                Couldn&apos;t unsubscribe
              </h1>
              <p className="text-muted">{errMsg}</p>
            </>
          )}
          <p>
            <Link to="/" className="text-accent hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}

export default WaitlistUnsubscribe;
