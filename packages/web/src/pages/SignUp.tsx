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
                <Link
                  to="/"
                  className="text-accent hover:text-accent/80 font-medium"
                >
                  Back to home
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
