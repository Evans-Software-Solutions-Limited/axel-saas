import { Link } from "react-router";
import { AppHeader } from "./AppHeader";

export function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <AppHeader />

      <main className="flex-1 flex flex-col min-h-0">{children}</main>

      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <p>© {new Date().getFullYear()} Axel. All rights reserved.</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="hover:text-accent transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-accent transition-colors">
              Terms of Service
            </Link>
            <a
              href="mailto:support@axel.ai"
              className="hover:text-accent transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default MarketingLayout;
