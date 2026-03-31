import { useState } from "react";
import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Use Cases", to: "/use-cases" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
] as const;

function getIsActive(to: string, pathname: string): boolean {
  if (to === "/") {
    return pathname === "/" || pathname.startsWith("/dashboard");
  }
  return pathname === to;
}

export function AppHeader() {
  const location = useLocation();
  const { isAuthenticated, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="border-b border-border-subtle bg-surface/80 backdrop-blur-xl sticky top-0 z-10 shrink-0">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-xl font-bold text-text flex items-center gap-2 tracking-tight"
        >
          <img src="/axel-logo.png" alt="Axel" className="w-8 h-8" />
          <span>
            Meet<span className="text-accent">Axel</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-8"
        >
          {NAV_LINKS.map(({ label, to }) => {
            const isActive = getIsActive(to, location.pathname);
            return (
              <Link
                key={to}
                to={to}
                className={`text-sm transition-colors duration-200 ${
                  isActive
                    ? "text-text font-medium"
                    : "text-muted hover:text-text"
                }`}
              >
                {label}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm px-4 py-2 rounded-lg border border-border text-text hover:bg-surface-elevated hover:border-accent/30 transition-all duration-200 font-medium"
            >
              Logout
            </button>
          ) : (
            <Link
              to={waitlistSignupHref()}
              className="text-sm px-5 py-2 cursor-pointer rounded-lg bg-accent-strong text-white hover:bg-accent-strong/90 transition-all duration-200 font-medium shadow-lg shadow-accent-strong/20"
            >
              Join waitlist
            </Link>
          )}
        </nav>

        {/* Mobile: CTA + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface-elevated"
            >
              Logout
            </button>
          ) : (
            <Link
              to={waitlistSignupHref()}
              className="text-sm px-3 py-1.5 rounded-lg bg-accent-strong text-white hover:bg-accent-strong/90 shadow-lg shadow-accent-strong/20"
            >
              Join waitlist
            </Link>
          )}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg text-text hover:bg-surface-elevated transition-colors"
          >
            {isMenuOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav menu */}
      {isMenuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden border-t border-border-subtle bg-surface/95 backdrop-blur-xl px-6 py-3 flex flex-col gap-1"
        >
          {NAV_LINKS.map(({ label, to }) => {
            const isActive = getIsActive(to, location.pathname);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setIsMenuOpen(false)}
                className={`text-sm py-2.5 px-3 rounded-lg transition-colors ${
                  isActive
                    ? "text-text font-medium bg-surface-elevated"
                    : "text-muted hover:text-text hover:bg-surface-elevated"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}

export default AppHeader;
