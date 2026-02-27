import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";

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
      navigate("/onboarding");
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#12141f] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center mx-auto mb-4 text-white text-xl font-bold">
            ⚡
          </div>
          <h1 className="text-3xl font-bold text-white">Axel</h1>
        </div>

        <div className="rounded-2xl border border-[#2a2d3e] bg-[#1e2130] p-8">
          <h2 className="mb-2 text-2xl font-bold text-white">Welcome back</h2>
          <p className="mb-8 text-sm text-[#8b8fa8]">
            Sign in to your Axel account
          </p>

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-white mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg bg-[#252840] px-4 py-3 text-white placeholder-[#8b8fa8] border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-white mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg bg-[#252840] px-4 py-3 text-white placeholder-[#8b8fa8] border border-[#2a2d3e] focus:border-indigo-500 focus:outline-none transition-colors duration-150"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-500 text-white py-3 rounded-lg font-medium hover:bg-indigo-600 disabled:bg-indigo-500/50 transition-colors duration-150 mt-6"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-[#8b8fa8]">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors duration-150"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
