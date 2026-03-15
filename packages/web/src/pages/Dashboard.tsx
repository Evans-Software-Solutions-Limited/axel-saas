import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import {
  IconChartBar,
  IconMessageCircle,
  IconListCheck,
  IconBolt,
  IconSettings,
  IconLogout,
  IconMenu2,
  IconX,
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { onboardingCompleted } = useAuth();

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
    // In a real app, this would call the auth logout
    navigate("/login");
  };

  const getCurrentNavItem = () => {
    return NAV_ITEMS.find((item) => location.pathname.startsWith(item.path));
  };

  const currentNav = getCurrentNavItem();

  return (
    <div className="h-screen bg-surface flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`bg-surface-raised border-r border-border transition-all duration-300 flex flex-col ${
          sidebarOpen ? "w-60" : "w-20"
        }`}
      >
        {/* Logo / Brand */}
        <div className="h-16 border-b border-border flex items-center justify-center px-4">
          <div className="text-xl font-bold text-accent">A</div>
        </div>

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
                title={
                  !sidebarOpen
                    ? isLocked
                      ? `${item.label} (locked)`
                      : item.label
                    : undefined
                }
                disabled={isLocked}
              >
                {item.icon}
                {sidebarOpen && (
                  <span className="font-medium flex items-center gap-2">
                    {item.label}
                    {isLocked && <IconLock className="w-3 h-3" />}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer with logout and legal links */}
        <div className="border-t border-border p-4 space-y-3">
          {/* Onboarding notice for pre-onboarding users */}
          {!onboardingCompleted && sidebarOpen && (
            <div className="px-4 py-2 bg-accent/10 border border-accent/20 rounded text-xs text-accent">
              Complete onboarding to unlock all features
            </div>
          )}
          {/* Legal Links */}
          {sidebarOpen && (
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
          )}
          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text hover:bg-surface-elevated transition-colors"
            title={!sidebarOpen ? "Logout" : undefined}
          >
            <IconLogout className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-surface-raised">
          <h1 className="text-xl font-bold text-text">
            {currentNav?.label || "Dashboard"}
          </h1>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-text hover:text-accent transition-colors p-2"
          >
            {sidebarOpen ? (
              <IconX className="w-5 h-5" />
            ) : (
              <IconMenu2 className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Content Area — flex so child routes (e.g. Office) can fill remaining space */}
        <div className="flex-1 flex flex-col min-h-0 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
