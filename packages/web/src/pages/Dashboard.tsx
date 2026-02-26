import { useState, useEffect } from "react";
import { useNavigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/Sidebar";

export function Dashboard() {
  const [activeTab, setActiveTab] = useState("chat");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  // Extract active tab from URL
  useEffect(() => {
    const pathParts = location.pathname.split("/");
    const tab = pathParts[pathParts.length - 1] || "chat";
    setActiveTab(tab);
  }, [location.pathname]);

  const handleNavigate = (tabId: string) => {
    setActiveTab(tabId);
    navigate(`/dashboard/${tabId}`);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const userInitial = user?.email?.[0]?.toUpperCase() || "U";
  const userPlan = (user as any)?.plan || "Starter";
  const userDisplayName =
    (user as any)?.displayName || user?.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-[#0a0a0a] dark text-white flex">
      <Sidebar
        activeTab={activeTab}
        onTabChange={handleNavigate}
        userInitial={userInitial}
        userPlan={userPlan}
        userDisplayName={userDisplayName}
        onSignOut={handleSignOut}
      />

      {/* Main content */}
      <div className="flex-1 ml-64 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}

export default Dashboard;
