import { useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import {
  IconChartBar,
  IconMessageCircle,
  IconListCheck,
  IconBolt,
  IconSettings,
  IconLogout,
  IconFileText,
  IconShield,
  IconLock,
} from "@tabler/icons-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "office",
    label: "Office",
    icon: <IconChartBar className="w-5 h-5" />,
    path: "/dashboard/office",
  },
  {
    id: "chat",
    label: "Chat",
    icon: <IconMessageCircle className="w-5 h-5" />,
    path: "/dashboard/chat",
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: <IconListCheck className="w-5 h-5" />,
    path: "/dashboard/tasks",
  },
  {
    id: "crons",
    label: "Crons",
    icon: <IconBolt className="w-5 h-5" />,
    path: "/dashboard/crons",
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: <IconChartBar className="w-5 h-5" />,
    path: "/dashboard/integrations",
  },
  {
    id: "settings",
    label: "Settings",
    icon: <IconSettings className="w-5 h-5" />,
    path: "/dashboard/settings",
  },
];

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { onboardingCompleted, signOut } = useAuth();

  // Pre-onboarding users are locked to Chat tab only.
  // Preserve the query string so post-checkout params (?checkout=success) survive.
  useEffect(() => {
    if (!onboardingCompleted && location.pathname !== "/dashboard/chat") {
      navigate(
        { pathname: "/dashboard/chat", search: location.search },
        { replace: true },
      );
    }
  }, [onboardingCompleted, location.pathname, location.search, navigate]);

  const handleLogout = () => {
    void signOut();
  };

  const getCurrentNavItem = () => {
    return NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  };

  const currentNav = getCurrentNavItem();

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex min-h-0">
        {/* Sidebar — glass panel */}
        <aside className="bg-surface-glass/60 backdrop-blur-xl border-r border-border-subtle transition-all duration-300 flex flex-col w-60">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = currentNav?.id === item.id;
              const isChat = item.id === "chat";
              const isLocked = !onboardingCompleted && !isChat;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) {
                      navigate("/dashboard/chat");
                    } else {
                      navigate(item.path);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 relative ${
                    isActive
                      ? "bg-accent-muted text-accent"
                      : isLocked
                        ? "text-muted/40 cursor-not-allowed"
                        : "text-text-secondary hover:text-text hover:bg-white/[0.03]"
                  }`}
                  title={isLocked ? `${item.label} (locked)` : item.label}
                  disabled={isLocked}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-full" />
                  )}
                  {item.icon}
                  <span className="font-medium text-sm flex items-center gap-2">
                    {item.label}
                    {isLocked && <IconLock className="w-3 h-3" />}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Footer with logout and legal links */}
          <div className="border-t border-border-subtle p-3 space-y-3">
            {/* Onboarding notice for pre-onboarding users */}
            {!onboardingCompleted && (
              <div className="px-3 py-2.5 bg-accent-muted border border-accent/15 rounded-xl text-xs text-accent">
                Complete onboarding to unlock all features
              </div>
            )}
            {/* Legal links */}
            <div className="flex gap-4 text-xs text-muted px-3">
              <Link
                to="/privacy"
                className="hover:text-accent transition-colors duration-200 flex items-center gap-1"
              >
                <IconShield className="w-3 h-3" />
                Privacy
              </Link>
              <Link
                to="/terms"
                className="hover:text-accent transition-colors duration-200 flex items-center gap-1"
              >
                <IconFileText className="w-3 h-3" />
                Terms
              </Link>
            </div>
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-text-secondary hover:text-text hover:bg-white/[0.03] transition-all duration-200"
              title="Logout"
            >
              <IconLogout className="w-5 h-5" />
              <span className="font-medium text-sm">Logout</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-gradient-to-br from-surface via-surface to-surface-raised/20">
          {/* Content Area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
