import { useState } from "react";
import { useNavigate, Outlet } from "react-router";
import {
  IconMessage,
  IconUsers,
  IconChecklist,
  IconClock,
  IconPlugConnected,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("office");
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const navItems = [
    { id: "chat", label: "Chat", icon: IconMessage },
    { id: "office", label: "Office", icon: IconUsers },
    { id: "tasks", label: "Tasks", icon: IconChecklist },
    { id: "crons", label: "Crons", icon: IconClock },
    { id: "integrations", label: "Integrations", icon: IconPlugConnected },
    { id: "settings", label: "Settings", icon: IconSettings },
  ];

  const handleNavigate = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/dashboard/${tabId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] dark text-white flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#111] border-r border-[#1a1a1a] p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            Axel
          </h1>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-blue-500 text-white"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-gray-400 hover:text-white hover:bg-[#1a1a1a] transition-colors w-full"
        >
          <IconLogout size={20} />
          <span>Sign out</span>
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

export default Dashboard;
