import { useState } from "react";
import {
  IconBrandGmail,
  IconBrandSlack,
  IconCalendar,
  IconDatabase,
  IconApi,
  IconBell,
} from "@tabler/icons-react";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
}

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "1",
      name: "Gmail",
      description: "Email management and automation",
      icon: <IconBrandGmail size={32} className="text-red-500" />,
      connected: true,
    },
    {
      id: "2",
      name: "Slack",
      description: "Team communication integration",
      icon: <IconBrandSlack size={32} className="text-blue-400" />,
      connected: false,
    },
    {
      id: "3",
      name: "Google Calendar",
      description: "Calendar and scheduling",
      icon: <IconCalendar size={32} className="text-blue-500" />,
      connected: true,
    },
    {
      id: "4",
      name: "PostgreSQL",
      description: "Database synchronization",
      icon: <IconDatabase size={32} className="text-blue-600" />,
      connected: false,
    },
    {
      id: "5",
      name: "REST API",
      description: "Generic API integration",
      icon: <IconApi size={32} className="text-purple-500" />,
      connected: true,
    },
    {
      id: "6",
      name: "Webhooks",
      description: "Real-time event notifications",
      icon: <IconBell size={32} className="text-amber-500" />,
      connected: false,
    },
  ]);

  const toggleConnection = (id: string) => {
    setIntegrations((prev) =>
      prev.map((integration) =>
        integration.id === id
          ? { ...integration, connected: !integration.connected }
          : integration,
      ),
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Integrations</h1>
        <p className="text-[#8b8fa8]">
          Connect your favorite tools and services
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <div
            key={integration.id}
            className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6 flex flex-col items-center text-center hover:border-[#3a3d4e] transition-colors duration-150"
          >
            <div className="mb-4">{integration.icon}</div>
            <h3 className="text-lg font-semibold text-white mb-1">
              {integration.name}
            </h3>
            <p className="text-sm text-[#8b8fa8] mb-4">
              {integration.description}
            </p>

            <div className="mb-4">
              <span
                className={`text-xs font-medium px-3 py-1 rounded-full ${
                  integration.connected
                    ? "bg-green-500/20 text-green-300"
                    : "bg-gray-500/20 text-gray-400"
                }`}
              >
                {integration.connected ? "Connected" : "Not Connected"}
              </span>
            </div>

            <button
              onClick={() => toggleConnection(integration.id)}
              className={`w-full py-2 rounded-lg font-medium transition-colors duration-150 ${
                integration.connected
                  ? "bg-red-500/20 text-red-300 hover:bg-red-500/30"
                  : "bg-indigo-500 text-white hover:bg-indigo-600"
              }`}
            >
              {integration.connected ? "Disconnect" : "Connect"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Integrations;
