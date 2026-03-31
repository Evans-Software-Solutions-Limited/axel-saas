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
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text mb-6 tracking-tight">
        Integrations
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card
            key={integration.name}
            className="border border-border/50 hover:border-border/80 transition-colors"
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-surface-elevated/60 flex items-center justify-center text-xl">
                    {integration.icon}
                  </div>
                  <div>
                    <p className="text-text font-medium text-sm">
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
                  className={`text-xs h-8 ${
                    integration.status === "connected"
                      ? "border-border/60 text-muted hover:text-text"
                      : "border-accent/40 text-accent hover:bg-accent/10"
                  }`}
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
