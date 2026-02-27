import { useNavigate } from "react-router";
import {
  IconLayoutDashboard,
  IconMessage,
  IconChecklist,
  IconClock,
  IconPlugConnected,
  IconSettings,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

interface SidebarProps {
  activePath: string;
}

export function Sidebar({ activePath }: SidebarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const navItems = [
    {
      label: "Dashboard",
      path: "/dashboard/office",
      icon: IconLayoutDashboard,
    },
    { label: "Chat", path: "/dashboard/chat", icon: IconMessage },
    { label: "Tasks", path: "/dashboard/tasks", icon: IconChecklist },
    { label: "Crons", path: "/dashboard/crons", icon: IconClock },
    {
      label: "Integrations",
      path: "/dashboard/integrations",
      icon: IconPlugConnected,
    },
    { label: "Settings", path: "/dashboard/settings", icon: IconSettings },
  ];

  const handleNavClick = (path: string) => {
    navigate(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="w-[220px] bg-[#1a1d2e] border-r border-[#2a2d3e] h-screen flex flex-col overflow-y-auto fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-[#2a2d3e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xl font-bold">
            ⚡
          </div>
          <h1 className="text-xl font-bold text-white">Axel</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.path;

          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors duration-150 ${
                isActive
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-[#8b8fa8] hover:text-white"
              }`}
            >
              <Icon size={20} />
              <span className="text-sm">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-[#2a2d3e] space-y-4">
        {/* User info */}
        {user && (
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-indigo-500/30 flex items-center justify-center mx-auto mb-2">
              <span className="text-indigo-300 font-bold text-sm">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-[#8b8fa8] truncate">{user.email}</p>
          </div>
        )}

        {/* Upgrade button */}
        <button className="w-full bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-600 transition-colors duration-150">
          Upgrade Plan
        </button>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full text-[#8b8fa8] hover:text-white text-sm font-medium transition-colors duration-150"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
