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
        {/* Sidebar */}
        <aside
          className={`bg-surface-raised border-r border-border transition-all duration-300 flex flex-col w-60`}
        >
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2">
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
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-accent text-white"
                      : isLocked
                        ? "text-muted/50 cursor-not-allowed"
                        : "text-text hover:bg-surface-elevated"
                  }`}
                  title={isLocked ? `${item.label} (locked)` : item.label}
                  disabled={isLocked}
                >
                  {item.icon}
                  {
                    <span className="font-medium flex items-center gap-2">
                      {item.label}
                      {isLocked && <IconLock className="w-3 h-3" />}
                    </span>
                  }
                </button>
              );
            })}
          </nav>

          {/* Footer with logout and legal links */}
          <div className="border-t border-border p-4 space-y-3">
            {/* Onboarding notice for pre-onboarding users */}
            {!onboardingCompleted && (
              <div className="px-4 py-2 bg-accent/10 border border-accent/20 rounded text-xs text-accent">
                Complete onboarding to unlock all features
              </div>
            )}
            {/* Legal links */}
            {
              <div className="flex gap-4 text-xs text-muted px-4">
                <Link
                  to="/privacy"
                  className="hover:text-accent transition-colors flex items-center gap-1"
                >
                  <IconShield className="w-3 h-3" />
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="hover:text-accent transition-colors flex items-center gap-1"
                >
                  <IconFileText className="w-3 h-3" />
                  Terms
                </Link>
              </div>
            }
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text hover:bg-surface-elevated transition-colors"
              title={"Logout"}
            >
              <IconLogout className="w-5 h-5" />
              {<span className="font-medium">Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Content Area — flex so child routes (e.g. Office) can fill remaining space */}
          <div className="flex-1 flex flex-col min-h-0 overflow-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
