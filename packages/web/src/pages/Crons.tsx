import { useState } from "react";
import CronRow from "@/components/CronRow";

interface Cron {
  id: string;
  name: string;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  status: "active" | "disabled" | "error";
}

export function Crons() {
  const [crons, setCrons] = useState<Cron[]>([
    {
      id: "1",
      name: "Morning briefing",
      schedule: "Daily at 8:00 AM",
      lastRun: new Date(Date.now() - 86400000),
      nextRun: new Date(Date.now() + 3600000),
      status: "active",
    },
    {
      id: "2",
      name: "Email digest",
      schedule: "Every 4 hours",
      lastRun: new Date(Date.now() - 7200000),
      nextRun: new Date(Date.now() + 3600000),
      status: "active",
    },
    {
      id: "3",
      name: "Weekly summary",
      schedule: "Monday at 9:00 AM",
      lastRun: new Date(Date.now() - 604800000),
      nextRun: new Date(Date.now() + 518400000),
      status: "disabled",
    },
  ]);

  const handleToggle = (cronId: string, enabled: boolean) => {
    setCrons(
      crons.map((cron) =>
        cron.id === cronId
          ? { ...cron, status: enabled ? "active" : "disabled" }
          : cron,
      ),
    );
  };

  return (
    <div className="p-6 bg-[#0a0a0a] min-h-screen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white">Crons</h1>
        <p className="text-gray-400 mt-2">
          Manage scheduled tasks and automations
        </p>
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#0a0a0a] border-b border-[#2a2a2a]">
            <tr>
              <th className="px-4 py-4 text-left text-sm font-semibold text-gray-400">
                Name
              </th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-gray-400">
                Schedule
              </th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-gray-400">
                Last Run
              </th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-gray-400">
                Next Run
              </th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-gray-400">
                Status
              </th>
              <th className="px-4 py-4 text-left text-sm font-semibold text-gray-400">
                Toggle
              </th>
            </tr>
          </thead>
          <tbody>
            {crons.map((cron) => (
              <CronRow
                key={cron.id}
                cronId={cron.id}
                name={cron.name}
                schedule={cron.schedule}
                lastRun={cron.lastRun}
                nextRun={cron.nextRun}
                status={cron.status}
                onToggleEnabled={(enabled) => handleToggle(cron.id, enabled)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Crons;
