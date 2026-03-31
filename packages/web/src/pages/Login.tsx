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
import { waitlistSignupHref } from "@/lib/waitlist";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const result = await signIn(email, password);
    if (result.success) {
      navigate("/");
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

          {/* Auth Card */}
          <Card className="border border-border/60 shadow-xl shadow-black/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-text text-lg">Welcome back</CardTitle>
              <CardDescription className="text-muted/80">
                Sign in to your Axel account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
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

                {/* Error Message */}
                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
                    {error}
                  </div>
                )}

                {/* Sign In Button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-accent hover:bg-accent/85 text-white h-11 text-sm font-medium shadow-sm shadow-accent/20"
                >
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-surface-raised text-muted/60">
                    Or
                  </span>
                </div>
              </div>

              {/* Google Sign In */}
              <Button
                variant="outline"
                className="w-full border-border/60 text-text hover:bg-surface-elevated h-11 text-sm"
                disabled={isLoading}
              >
                Sign in with Google
              </Button>

              {/* Sign Up Link */}
              <p className="text-center text-sm text-muted">
                Need access?{" "}
                <Link
                  to={waitlistSignupHref()}
                  className="text-accent hover:text-accent/80 font-medium"
                >
                  Join the waitlist
                </Link>
              </p>

              {/* Legal Links */}
              <p className="text-center text-xs text-muted/60 pt-2">
                By signing in, you agree to our{" "}
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

export default Login;
