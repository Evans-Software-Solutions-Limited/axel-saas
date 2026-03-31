import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { Button } from "@axel-saas/ui/button";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import { joinWaitlist, type WaitlistInterestedIn } from "@/lib/waitlistApi";

const TIERS: { value: WaitlistInterestedIn; label: string }[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Premium" },
  { value: "enterprise", label: "Enterprise" },
];

export function WaitlistForm() {
  const [params] = useSearchParams();
  const tierParam = params.get("tier");

  const initialTier = useMemo((): WaitlistInterestedIn => {
    if (
      tierParam === "free" ||
      tierParam === "pro" ||
      tierParam === "enterprise"
    ) {
      return tierParam;
    }
    return "free";
  }, [tierParam]);

  const [email, setEmail] = useState("");
  const [interestedIn, setInterestedIn] =
    useState<WaitlistInterestedIn>(initialTier);

  useEffect(() => {
    setInterestedIn(initialTier);
  }, [initialTier]);

  const [submitState, setSubmitState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitState("loading");
    setFeedback(null);
    const res = await joinWaitlist({
      email: email.trim(),
      interestedIn,
    });
    if (res.ok) {
      setSubmitState("success");
      setFeedback(
        res.status === "joined"
          ? "You're on the list. Check your inbox for confirmation."
          : "Your preference was updated. Check your inbox for confirmation.",
      );
      return;
    }
    setSubmitState("error");
    setFeedback(res.error);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 text-left max-w-md mx-auto"
    >
      <div className="space-y-2">
        <Label
          htmlFor="waitlist-email"
          className="text-text text-sm font-medium"
        >
          Email
        </Label>
        <Input
          id="waitlist-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="bg-surface-raised border-border text-text placeholder:text-muted/50"
        />
      </div>
      <div className="space-y-2">
        <Label
          htmlFor="waitlist-tier"
          className="text-text text-sm font-medium"
        >
          I&apos;m interested in
        </Label>
        <select
          id="waitlist-tier"
          name="interestedIn"
          value={interestedIn}
          onChange={(e) =>
            setInterestedIn(e.target.value as WaitlistInterestedIn)
          }
          className="w-full h-10 rounded-lg border border-border bg-surface-raised px-3 text-sm text-text transition-colors duration-200 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {TIERS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {feedback && (
        <p
          className={`text-sm ${
            submitState === "success" ? "text-success" : "text-destructive"
          }`}
          role={submitState === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      )}
      <Button
        type="submit"
        disabled={submitState === "loading" || submitState === "success"}
        className="w-full bg-accent-strong hover:bg-accent-strong/90 text-white shadow-lg shadow-accent-strong/20 transition-all duration-200"
      >
        {submitState === "loading" ? "Submitting..." : "Join waitlist"}
      </Button>
    </form>
  );
}
