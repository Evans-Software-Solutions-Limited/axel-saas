import { Button } from "@axel-saas/ui/button";
import { Card, CardContent } from "@axel-saas/ui/card";
import {
  IconMail,
  IconBrandSlack,
  IconCalendar,
  IconNote,
} from "@tabler/icons-react";

const integrations = [
  {
    name: "Gmail",
    status: "connected" as const,
    icon: IconMail,
    color: "text-red-400",
  },
  {
    name: "Slack",
    status: "connected" as const,
    icon: IconBrandSlack,
    color: "text-purple-400",
  },
  {
    name: "Google Calendar",
    status: "connected" as const,
    icon: IconCalendar,
    color: "text-blue-400",
  },
  {
    name: "Notion",
    status: "not-connected" as const,
    icon: IconNote,
    color: "text-muted",
  },
];

export function Integrations() {
  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card
              key={integration.name}
              className="border-border-subtle hover:border-accent/20 transition-all duration-200"
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-surface-elevated flex items-center justify-center border border-border-subtle">
                      <Icon
                        className={`w-5 h-5 ${integration.color}`}
                        stroke={1.5}
                      />
                    </div>
                    <div>
                      <p className="text-text font-medium">
                        {integration.name}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {integration.status === "connected" ? (
                          <span className="text-success">Connected</span>
                        ) : (
                          "Not connected"
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="border-border text-text text-xs hover:border-accent/30 hover:bg-surface-elevated transition-all duration-200"
                  >
                    {integration.status === "connected" ? "Manage" : "Connect"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
