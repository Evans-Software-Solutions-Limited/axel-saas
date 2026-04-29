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
    <header className="border-b border-border-subtle bg-surface-glass/80 backdrop-blur-2xl sticky top-0 z-50 shrink-0">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link
          to="/"
          className="text-xl font-display font-bold text-text flex items-center group"
        >
          <img src="/axel-logo.png" alt="Axel" className="w-8 h-8 mr-2" />
          Meet
          <span className="text-accent group-hover:drop-shadow-[0_0_8px_var(--color-accent-glow)] transition-all duration-300">
            Axel
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
                className={`relative text-sm transition-colors duration-200 ${
                  isActive
                    ? "text-text font-medium"
                    : "text-text-secondary hover:text-text"
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute -bottom-1 left-0 right-0 h-px bg-accent" />
                )}
              </Link>
            );
          })}
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm px-4 py-2 rounded-full border border-border text-text-secondary hover:text-text hover:border-border-accent hover:bg-white/[0.03] transition-all duration-200 font-medium"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-text-secondary hover:text-text transition-colors duration-200"
              >
                Sign in
              </Link>
              <Link
                to={waitlistSignupHref()}
                className="text-sm px-5 py-2 cursor-pointer rounded-full bg-gradient-to-br from-accent to-accent/80 text-[#08090d] font-semibold hover:from-accent-light hover:to-accent hover:shadow-[0_0_24px_-4px_var(--color-accent-glow)] transition-all duration-300"
              >
                Join waitlist
              </Link>
            </>
          )}
        </nav>

        {/* Mobile: CTA + hamburger */}
        <div className="md:hidden flex items-center gap-2">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="text-sm px-3 py-1.5 rounded-full border border-border text-text-secondary hover:text-text hover:border-border-accent"
            >
              Logout
            </button>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-text-secondary hover:text-text"
              >
                Sign in
              </Link>
              <Link
                to={waitlistSignupHref()}
                className="text-sm px-4 py-1.5 rounded-full bg-gradient-to-br from-accent to-accent/80 text-[#08090d] font-semibold"
              >
                Join waitlist
              </Link>
            </>
          )}
          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-white/[0.04] transition-colors"
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
          className="md:hidden border-t border-border-subtle bg-surface-glass/90 backdrop-blur-2xl px-4 py-3 flex flex-col gap-1 animate-fade-in"
        >
          {NAV_LINKS.map(({ label, to }) => {
            const isActive = getIsActive(to, location.pathname);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setIsMenuOpen(false)}
                className={`text-sm py-2.5 px-3 rounded-lg transition-colors duration-200 ${
                  isActive
                    ? "text-text font-medium bg-white/[0.04]"
                    : "text-text-secondary hover:text-text hover:bg-white/[0.03]"
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
