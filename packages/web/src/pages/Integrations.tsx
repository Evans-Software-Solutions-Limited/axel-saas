import { Button } from "@axel-saas/ui/button";
import { Card, CardContent } from "@axel-saas/ui/card";

export function Integrations() {
  const integrations = [
    { name: "Gmail", status: "connected", icon: "📧" },
    { name: "Slack", status: "connected", icon: "💬" },
    { name: "Google Calendar", status: "connected", icon: "📅" },
    { name: "Notion", status: "not-connected", icon: "📝" },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card key={integration.name} className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <p className="text-text font-medium">{integration.name}</p>
                    <p className="text-xs text-muted">
                      {integration.status === "connected"
                        ? "Connected"
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-border text-text text-xs"
                >
                  {integration.status === "connected" ? "Manage" : "Connect"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
