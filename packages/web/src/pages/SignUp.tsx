import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
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
import { RELEASE_EXPECTATION_COPY, waitlistSignupHref } from "@/lib/waitlist";

export function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        navigate("/subscribe");
      } else {
        setError(result.error || "Failed to create account");
      }
    } catch {
      setError("An error occurred. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <MarketingLayout>
      <div className="flex-1 flex items-center justify-center p-6 py-16">
        <div className="w-full max-w-md space-y-8">
          {/* Axel Wordmark & Tagline */}
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold text-text tracking-tight">
              <span className="text-accent">A</span>xel
            </h1>
            <p className="text-sm text-muted/80">
              One assistant. Every kind of work.
            </p>
          </div>

          <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 text-sm text-muted text-left space-y-2">
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
          <Card className="border border-border/60 shadow-xl shadow-black/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-text text-lg">
                Create an account
              </CardTitle>
              <CardDescription className="text-muted/80">
                For invited users. Set up takes about two minutes. If we need to
                verify your email, we&apos;ll send a quick confirmation message.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-muted text-xs font-medium uppercase tracking-wider"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="John Doe"
                    className="bg-surface border-border/60 text-text placeholder:text-muted/50 h-11"
                  />
                </div>

                {/* Email Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-muted text-xs font-medium uppercase tracking-wider"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="bg-surface border-border/60 text-text placeholder:text-muted/50 h-11"
                  />
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-muted text-xs font-medium uppercase tracking-wider"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-surface border-border/60 text-text placeholder:text-muted/50 h-11"
                  />
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-muted text-xs font-medium uppercase tracking-wider"
                  >
                    Confirm Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-surface border-border/60 text-text placeholder:text-muted/50 h-11"
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                {/* Sign Up Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent/85 text-white h-11 text-sm font-medium shadow-sm shadow-accent/20"
                >
                  {isLoading ? "Creating account..." : "Create account"}
                </Button>
              </form>

              {/* Sign In Link */}
              <p className="text-center text-sm text-muted">
                <Link
                  to="/"
                  className="text-accent hover:text-accent/80 font-medium"
                >
                  Back to home
                </Link>
              </p>

              {/* Legal Links */}
              <p className="text-center text-xs text-muted/60 pt-2">
                By signing up, you agree to our{" "}
                <Link
                  to="/terms"
                  className="text-muted hover:text-text transition-colors"
                >
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  to="/privacy"
                  className="text-muted hover:text-text transition-colors"
                >
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
