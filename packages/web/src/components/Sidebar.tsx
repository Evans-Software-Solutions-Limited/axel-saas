import React from "react";
import {
  IconMessage,
  IconBriefcase,
  IconChecklist,
  IconClock,
  IconPlug,
  IconSettings,
  IconLogout,
} from "@tabler/icons-react";
import AxelLogo from "./AxelLogo";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

interface SidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  userInitial: string;
  userPlan: string;
  userDisplayName?: string;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  userInitial,
  userPlan,
  userDisplayName = "User",
  onSignOut,
}) => {
  const navItems: NavItem[] = [
    { id: "chat", label: "Chat", icon: <IconMessage size={20} /> },
    { id: "office", label: "Office", icon: <IconBriefcase size={20} /> },
    { id: "tasks", label: "Tasks", icon: <IconChecklist size={20} /> },
    { id: "crons", label: "Crons", icon: <IconClock size={20} /> },
    { id: "integrations", label: "Integrations", icon: <IconPlug size={20} /> },
    { id: "settings", label: "Settings", icon: <IconSettings size={20} /> },
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-[#111] border-r border-[#1a1a1a] p-6 flex flex-col overflow-y-auto">
      {/* Logo */}
      <div className="mb-8">
        <AxelLogo size="md" variant="text" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors duration-150 ${
              activeTab === item.id
                ? "border-l-2 border-blue-500 bg-blue-500/10 text-blue-400"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Separator */}
      <Separator className="my-4 bg-[#2a2a2a]" />

      {/* User Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            {userInitial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {userDisplayName}
            </div>
            <div className="text-xs text-gray-400">{userPlan}</div>
          </div>
        </div>

        <Button
          onClick={onSignOut}
          variant="ghost"
          className="w-full justify-start text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
        >
          <IconLogout size={20} />
          <span>Sign out</span>
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
