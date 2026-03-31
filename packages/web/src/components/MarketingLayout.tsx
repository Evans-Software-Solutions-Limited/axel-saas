import { Link } from "react-router";
import { AppHeader } from "./AppHeader";

export function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <AppHeader />

      <main className="flex-1 flex flex-col min-h-0">{children}</main>

      <footer className="border-t border-border/60 py-12 px-6">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-sm text-muted">
            <p className="font-medium">
              © {new Date().getFullYear()} Axel. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-6">
              <Link to="/privacy" className="hover:text-text transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-text transition-colors">
                Terms of Service
              </Link>
              <a
                href="mailto:admin@evans-software-solutions.com"
                className="hover:text-text transition-colors"
              >
                Contact
              </a>
            </div>
          </div>

          <div className="border-t border-border/40 pt-6 space-y-3">
            <p className="text-xs text-muted/80 leading-relaxed max-w-3xl">
              Axel is powered by{" "}
              <a
                href="https://openclaw.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                OpenClaw
              </a>
              , an open-source AI agent framework. Axel is an independent
              product and is not officially affiliated with or endorsed by the
              OpenClaw project.
            </p>

            <p className="text-xs text-muted/80 leading-relaxed max-w-3xl">
              Your data is yours. We don&apos;t train on your conversations or
              sell your information.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MarketingLayout;
