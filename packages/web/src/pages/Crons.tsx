import { Badge } from "@axel-saas/ui/badge";
import {
  IconClock,
  IconCalendarRepeat,
  IconDatabase,
} from "@tabler/icons-react";

const SCHEDULES = [
  {
    name: "Daily email digest",
    schedule: "Every day at 9:00 AM",
    status: "Active" as const,
    icon: IconClock,
  },
  {
    name: "Weekly report generation",
    schedule: "Every Monday at 2:00 PM",
    status: "Active" as const,
    icon: IconCalendarRepeat,
  },
  {
    name: "Document indexing",
    schedule: "Every 6 hours",
    status: "Active" as const,
    icon: IconDatabase,
  },
];

export function Crons() {
  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text">
          Automated Schedules
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Recurring tasks your agents run automatically
        </p>
      </div>

      {/* Schedule items */}
      <div className="space-y-3">
        {SCHEDULES.map(({ name, schedule, status, icon: Icon }) => (
          <div
            key={name}
            className="glass-card rounded-xl p-5 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center">
                <Icon className="w-5 h-5 text-accent" stroke={1.5} />
              </div>
              <div>
                <p className="text-text font-medium">{name}</p>
                <p className="text-sm text-text-secondary">{schedule}</p>
              </div>
            </div>
            <Badge className="bg-success/15 text-success border-0">
              {status}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
