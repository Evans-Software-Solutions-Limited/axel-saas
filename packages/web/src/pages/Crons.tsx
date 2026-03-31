import { Card, CardContent, CardHeader, CardTitle } from "@axel-saas/ui/card";
import { Badge } from "@axel-saas/ui/badge";

// ============================================================================
// CRONS TAB
// ============================================================================

const SCHEDULES = [
  {
    name: "Daily email digest",
    schedule: "Every day at 9:00 AM",
    active: true,
  },
  {
    name: "Weekly report generation",
    schedule: "Every Monday at 2:00 PM",
    active: true,
  },
  {
    name: "Document indexing",
    schedule: "Every 6 hours",
    active: true,
  },
] as const;

export function Crons() {
  return (
    <div className="p-6">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-text tracking-tight">
            Automated Schedules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SCHEDULES.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between p-4 bg-surface-elevated/50 rounded-xl border border-border-subtle hover:border-accent/20 transition-all duration-200"
            >
              <div>
                <p className="text-text font-medium">{item.name}</p>
                <p className="text-sm text-muted mt-0.5">{item.schedule}</p>
              </div>
              <Badge className="bg-success/15 text-success border-0">
                Active
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
