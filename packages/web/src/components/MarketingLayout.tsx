import { Link } from "react-router";
import { AppHeader } from "./AppHeader";

export function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface flex flex-col relative">
      <AppHeader />

      {/* Ambient hero glow */}
      <div
        className="ambient-orb w-[800px] h-[600px] -top-[200px] left-1/2 -translate-x-1/2 fixed opacity-40"
        style={{
          background:
            "radial-gradient(ellipse, rgba(13, 211, 176, 0.07) 0%, transparent 70%)",
        }}
      />

      <main className="flex-1 flex flex-col min-h-0 relative grain">
        {children}
      </main>

      <footer className="border-t border-border-subtle py-10 px-4 relative z-10">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-text-secondary">
            <p className="font-display">
              &copy; {new Date().getFullYear()} Axel. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-6">
              <Link
                to="/privacy"
                className="hover:text-accent transition-colors duration-200"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="hover:text-accent transition-colors duration-200"
              >
                Terms of Service
              </Link>
              <a
                href="mailto:admin@evans-software-solutions.com"
                className="hover:text-accent transition-colors duration-200"
              >
                Contact
              </a>
            </div>
          </div>

          <p className="text-xs text-muted leading-relaxed max-w-3xl">
            Axel is powered by{" "}
            <a
              href="https://openclaw.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              OpenClaw
            </a>
            , an open-source AI agent framework. Axel is an independent product
            and is not officially affiliated with or endorsed by the OpenClaw
            project.
          </p>

          <p className="text-xs text-muted leading-relaxed max-w-3xl">
            Your data is yours. We don&apos;t train on your conversations or
            sell your information.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default MarketingLayout;
