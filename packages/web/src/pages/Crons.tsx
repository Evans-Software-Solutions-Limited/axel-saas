import { Card, CardContent, CardHeader, CardTitle } from "@axel-saas/ui/card";
import { Badge } from "@axel-saas/ui/badge";

// ============================================================================
// CRONS TAB
// ============================================================================

export function Crons() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text mb-6 tracking-tight">
        Schedules
      </h1>
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-text text-base">
            Automated Schedules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/40">
            <div>
              <p className="text-text font-medium text-sm">
                Daily email digest
              </p>
              <p className="text-xs text-muted mt-0.5">Every day at 9:00 AM</p>
            </div>
            <Badge className="bg-success/15 text-success border-0 text-xs">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/40">
            <div>
              <p className="text-text font-medium text-sm">
                Weekly report generation
              </p>
              <p className="text-xs text-muted mt-0.5">
                Every Monday at 2:00 PM
              </p>
            </div>
            <Badge className="bg-success/15 text-success border-0 text-xs">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface/50 rounded-lg border border-border/40">
            <div>
              <p className="text-text font-medium text-sm">Document indexing</p>
              <p className="text-xs text-muted mt-0.5">Every 6 hours</p>
            </div>
            <Badge className="bg-success/15 text-success border-0 text-xs">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
