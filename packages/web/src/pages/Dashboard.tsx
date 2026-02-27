import { useLocation } from "react-router";
import { Outlet } from "react-router";
import { IconBell, IconSearch } from "@tabler/icons-react";
import { Sidebar } from "@/components/Sidebar";
import { useAuth } from "@/hooks/useAuth";

export function Dashboard() {
  const location = useLocation();
  const { user } = useAuth();

  // Extract the tab name from the URL
  const currentPath = location.pathname;

  return (
    <div className="bg-[#12141f] min-h-screen flex">
      {/* Sidebar */}
      <Sidebar activePath={currentPath} />

      {/* Main content area */}
      <div className="ml-[220px] flex-1 flex flex-col">
        {/* Top header */}
        <div className="h-16 bg-[#1a1d2e] border-b border-[#2a2d3e] flex items-center justify-between px-8">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Welcome back,{user?.email ? ` ${user.email.split("@")[0]}` : ""}
            </h2>
            <p className="text-sm text-[#8b8fa8]">
              Manage your AI assistants below
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-[#252840] rounded-lg transition-colors duration-150">
              <IconSearch size={20} className="text-[#8b8fa8]" />
            </button>
            <button className="p-2 hover:bg-[#252840] rounded-lg transition-colors duration-150">
              <IconBell size={20} className="text-[#8b8fa8]" />
            </button>
            <div className="w-10 h-10 rounded-full bg-indigo-500/30 flex items-center justify-center">
              <span className="text-indigo-300 font-bold">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
