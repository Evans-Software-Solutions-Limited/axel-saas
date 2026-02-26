import { useState } from "react";
import IntegrationCard from "@/components/IntegrationCard";

interface Integration {
  id: string;
  name: string;
  icon: string;
  isConnected: boolean;
}

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "1",
      name: "Telegram",
      icon: "📱",
      isConnected: true,
    },
    {
      id: "2",
      name: "Slack",
      icon: "💬",
      isConnected: false,
    },
    {
      id: "3",
      name: "Email",
      icon: "📧",
      isConnected: true,
    },
    {
      id: "4",
      name: "Google Calendar",
      icon: "📅",
      isConnected: false,
    },
    {
      id: "5",
      name: "GitHub",
      icon: "🐙",
      isConnected: true,
    },
    {
      id: "6",
      name: "WhatsApp",
      icon: "💚",
      isConnected: false,
    },
  ]);

  const handleConnect = (integrationId: string) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === integrationId
          ? { ...integration, isConnected: true }
          : integration,
      ),
    );
  };

  const handleDisconnect = (integrationId: string) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === integrationId
          ? { ...integration, isConnected: false }
          : integration,
      ),
    );
  };

  return (
    <div className="p-6 bg-[#0a0a0a] min-h-screen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white">Integrations</h1>
        <p className="text-gray-400 mt-2">
          Connect your favourite tools and services
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integrationId={integration.id}
            name={integration.name}
            icon={integration.icon}
            isConnected={integration.isConnected}
            onConnect={() => handleConnect(integration.id)}
            onDisconnect={() => handleDisconnect(integration.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default Integrations;
