import { useState } from "react";
import { Outlet, useNavigate, useLocation, Link } from "react-router";
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
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  requiresOnboarding: boolean;
}

// All available navigation items
const ALL_NAV_ITEMS: NavItem[] = [
  {
    id: "office",
    label: "Office",
    icon: <IconChartBar className="w-5 h-5" />,
    path: "/dashboard/office",
    requiresOnboarding: true,
  },
  {
    id: "chat",
    label: "Chat",
    icon: <IconMessageCircle className="w-5 h-5" />,
    path: "/dashboard/chat",
    requiresOnboarding: false, // Chat is always available
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: <IconListCheck className="w-5 h-5" />,
    path: "/dashboard/tasks",
    requiresOnboarding: true,
  },
  {
    id: "crons",
    label: "Crons",
    icon: <IconBolt className="w-5 h-5" />,
    path: "/dashboard/crons",
    requiresOnboarding: true,
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: <IconChartBar className="w-5 h-5" />,
    path: "/dashboard/integrations",
    requiresOnboarding: true,
  },
  {
    id: "settings",
    label: "Settings",
    icon: <IconSettings className="w-5 h-5" />,
    path: "/dashboard/settings",
    requiresOnboarding: true,
  },
];

export function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const { onboardingCompleted, signOut } = useAuth();

  // Filter nav items based on onboarding status
  // Pre-onboarding: only Chat is available
  // Post-onboarding: all tabs are available
  const navItems = onboardingCompleted
    ? ALL_NAV_ITEMS
    : ALL_NAV_ITEMS.filter((item) => !item.requiresOnboarding);

  const handleLogout = async () => {
    await signOut();
  };

  const getCurrentNavItem = () => {
    return navItems.find((item) => location.pathname.startsWith(item.path));
  };

  const currentNav = getCurrentNavItem();

  // Handle click on locked items - show lock message or redirect to chat
  const handleLockedNavClick = (item: NavItem) => {
    if (item.requiresOnboarding && !onboardingCompleted) {
      // Redirect to chat where onboarding happens
      navigate("/dashboard/chat");
      return;
    }
    navigate(item.path);
  };

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
          {ALL_NAV_ITEMS.map((item) => {
            const isAvailable = !item.requiresOnboarding || onboardingCompleted;
            const isActive = currentNav?.id === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => isAvailable ? navigate(item.path) : handleLockedNavClick(item)}
                disabled={!isAvailable}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : isAvailable
                      ? "text-text hover:bg-surface-elevated"
                      : "text-muted/50 cursor-not-allowed opacity-50"
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                {item.icon}
                {sidebarOpen && (
                  <span className="font-medium flex items-center gap-2">
                    {item.label}
                    {!isAvailable && <IconLock className="w-3 h-3" />}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer with logout and legal links */}
        <div className="border-t border-border p-4 space-y-3">
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
