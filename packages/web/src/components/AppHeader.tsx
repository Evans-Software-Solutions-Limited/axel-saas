import { Link, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { waitlistSignupHref } from "@/lib/waitlist";

const NAV_LINKS = [
  { label: "Home", to: "/" },
  { label: "Use Cases", to: "/use-cases" },
  { label: "Pricing", to: "/pricing" },
  { label: "About", to: "/about" },
] as const;

export function AppHeader() {
  const location = useLocation();
  const { isAuthenticated, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-surface-raised sticky top-0 z-10 shrink-0">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-text flex items-center">
          <img src="/axel-logo.png" alt="Axel" className="w-8 h-8 mr-2" />
          Meet<span className="text-accent">Axel</span>
        </Link>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden md:flex items-center gap-6"
        >
          {NAV_LINKS.map(({ label, to }) => {
            const isHome = to === "/";
            const isActive = isHome
              ? location.pathname === "/" ||
                location.pathname.startsWith("/dashboard")
              : location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`text-sm transition-colors ${
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
            <>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm px-4 py-2 rounded-md border border-border text-text hover:bg-surface-elevated transition-colors font-medium"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to={waitlistSignupHref()}
              className="text-sm px-4 py-2 cursor-pointer rounded-md bg-accent text-white hover:bg-accent/90 transition-colors font-medium"
            >
              Join waitlist
            </Link>
          )}
        </nav>

        {/* Mobile: same actions, compact */}
        <div className="md:hidden flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => void signOut()}
                className="text-sm px-3 py-1.5 rounded-md border border-border text-text hover:bg-surface-elevated"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to={waitlistSignupHref()}
              className="text-sm px-3 py-1.5 rounded-md bg-accent text-white hover:bg-accent/90"
            >
              Join waitlist
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
