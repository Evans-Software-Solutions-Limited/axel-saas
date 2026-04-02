import { Button } from "@axel-saas/ui/button";
import {
  IconMail,
  IconBrandSlack,
  IconCalendar,
  IconNotes,
} from "@tabler/icons-react";

const integrations = [
  {
    name: "Gmail",
    status: "connected" as const,
    icon: IconMail,
    color: "text-red-400",
    bgColor: "bg-red-400/10",
  },
  {
    name: "Slack",
    status: "connected" as const,
    icon: IconBrandSlack,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
  },
  {
    name: "Google Calendar",
    status: "connected" as const,
    icon: IconCalendar,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
  },
  {
    name: "Notion",
    status: "not-connected" as const,
    icon: IconNotes,
    color: "text-text-secondary",
    bgColor: "bg-white/[0.04]",
  },
];

export function Integrations() {
  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text">
          Integrations
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Connect the tools you already use
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          const isConnected = integration.status === "connected";

          return (
            <div
              key={integration.name}
              className={`glass-card rounded-xl p-5 ${
                !isConnected ? "border-dashed opacity-70" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-xl ${integration.bgColor} flex items-center justify-center`}
                  >
                    <Icon
                      className={`w-5 h-5 ${integration.color}`}
                      stroke={1.5}
                    />
                  </div>
                  <div>
                    <p className="text-text font-medium">{integration.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {isConnected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-success" />
                      )}
                      <p className="text-xs text-text-secondary">
                        {isConnected ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  variant={isConnected ? "ghost" : "outline"}
                  className="text-xs"
                >
                  {isConnected ? "Manage" : "Connect"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
