import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { provisionFreeSilently } from "./subscribeApi";
import { MarketingLayout } from "@/components/MarketingLayout";
import { Button } from "@axel-saas/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@axel-saas/ui/card";
import { Input } from "@axel-saas/ui/input";
import { Label } from "@axel-saas/ui/label";
import { IconMailFilled } from "@tabler/icons-react";
import { RELEASE_EXPECTATION_COPY, waitlistSignupHref } from "@/lib/waitlist";

export function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when Supabase returns success-without-session — i.e. the user
  // needs to click the verification email before the session exists. We
  // render a "check your email" view in this state rather than routing
  // to /subscribe (which would 401 on free-tier provisioning).
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp(email, password);
      if (result.success) {
        if (result.requiresEmailConfirmation) {
          // No session yet — skip provisionFreeSilently (it would 401)
          // and surface a "check your email" success state. The free
          // row gets created on Subscribe mount-time / ChatContainer
          // self-heal once the user clicks through the verify link.
          setPendingVerificationEmail(email);
        } else {
          // Session was issued immediately (email confirmation disabled
          // in this Supabase project) — keep the existing flow.
          await provisionFreeSilently();
          navigate("/subscribe");
        }
      } else {
        setError(result.error || "Failed to create account");
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
    setIsLoading(false);
  };

  if (pendingVerificationEmail) {
    return (
      <MarketingLayout>
        <div className="flex-1 flex items-center justify-center p-4 py-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-bold text-text">
                <span className="text-accent">A</span>xel
              </h1>
              <p className="text-sm text-muted">
                One assistant. Every kind of work.
              </p>
            </div>

            <Card className="border border-border">
              <CardHeader>
                <div className="mx-auto w-12 h-12 rounded-full bg-accent-muted flex items-center justify-center mb-2">
                  <IconMailFilled
                    className="w-6 h-6 text-accent"
                    stroke={1.5}
                  />
                </div>
                <CardTitle className="text-text text-center">
                  Check your email
                </CardTitle>
                <CardDescription className="text-center">
                  We&apos;ve sent a confirmation link to{" "}
                  <span className="text-text font-medium">
                    {pendingVerificationEmail}
                  </span>
                  . Click the link to finish setting up your account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted text-center">
                  No email after a couple of minutes? Check your spam folder, or{" "}
                  <button
                    type="button"
                    onClick={() => setPendingVerificationEmail(null)}
                    className="text-accent hover:underline font-medium"
                  >
                    try a different address
                  </button>
                  .
                </p>
                <p className="text-center text-sm text-muted">
                  Already verified?{" "}
                  <Link
                    to="/login"
                    className="text-accent hover:text-accent/80 font-medium"
                  >
                    Sign in
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </MarketingLayout>
    );
  }

  return (
    <MarketingLayout>
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Axel Wordmark & Tagline */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-text">
              <span className="text-accent">A</span>xel
            </h1>
            <p className="text-sm text-muted">
              One assistant. Every kind of work.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-surface-raised p-4 text-sm text-muted text-left space-y-2">
            <p className="font-medium text-text">Looking for access?</p>
            <p>
              {RELEASE_EXPECTATION_COPY}{" "}
              <Link
                to={waitlistSignupHref()}
                className="text-accent font-medium hover:underline"
              >
                Join the waitlist
              </Link>{" "}
              on the home page — that&apos;s how we&apos;re onboarding first.
            </p>
          </div>

          {/* Signup Card */}
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-text">Create an account</CardTitle>
              <CardDescription>
                For invited users. Set up takes about two minutes. If we need to
                verify your email, we&apos;ll send a quick confirmation message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-text">
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="John Doe"
                    className="bg-surface-raised border-border text-text placeholder:text-muted"
                  />
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-text">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="bg-surface-raised border-border text-text placeholder:text-muted"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-text">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-surface-raised border-border text-text placeholder:text-muted"
                  />
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-text">
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-surface-raised border-border text-text placeholder:text-muted"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/30">
                    {error}
                  </div>
                )}

                {/* Sign Up Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>

              {/* Sign In Link */}
              <p className="text-center text-sm text-muted">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="text-accent hover:text-accent/80 font-medium"
                >
                  Sign in
                </Link>
              </p>

              {/* Legal Links */}
              <p className="text-center text-xs text-muted mt-4">
                By signing up, you agree to our{" "}
                <Link to="/terms" className="text-accent hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-accent hover:underline">
                  Privacy Policy
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </MarketingLayout>
  );
}

export default SignUp;
