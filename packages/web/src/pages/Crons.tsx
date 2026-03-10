import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// CRONS TAB
// ============================================================================

export function Crons() {
  return (
    <div className="p-6">
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-text">Automated Schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
            <div>
              <p className="text-text font-medium">Daily email digest</p>
              <p className="text-sm text-muted">Every day at 9:00 AM</p>
            </div>
            <Badge className="bg-success/20 text-success border-0">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
            <div>
              <p className="text-text font-medium">Weekly report generation</p>
              <p className="text-sm text-muted">Every Monday at 2:00 PM</p>
            </div>
            <Badge className="bg-success/20 text-success border-0">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
            <div>
              <p className="text-text font-medium">Document indexing</p>
              <p className="text-sm text-muted">Every 6 hours</p>
            </div>
            <Badge className="bg-success/20 text-success border-0">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
