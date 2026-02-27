import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import {
  IconChartBar,
  IconMessageCircle,
  IconListCheck,
  IconBolt,
  IconSettings,
  IconLogout,
  IconMenu2,
  IconX,
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
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-accent text-white"
                    : "text-text hover:bg-surface-elevated"
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                {item.icon}
                {sidebarOpen && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-4 space-y-2">
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

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
