import { useState } from "react";

interface Cron {
  id: string;
  name: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  status: boolean;
}

export function Crons() {
  const [crons, setCrons] = useState<Cron[]>([
    {
      id: "1",
      name: "Daily Email Digest",
      schedule: "0 9 * * *",
      lastRun: "Today, 9:00 AM",
      nextRun: "Tomorrow, 9:00 AM",
      status: true,
    },
    {
      id: "2",
      name: "Weekly Report Generation",
      schedule: "0 10 * * MON",
      lastRun: "Mon, 10:00 AM",
      nextRun: "Next Mon, 10:00 AM",
      status: true,
    },
    {
      id: "3",
      name: "Database Cleanup",
      schedule: "0 2 * * *",
      lastRun: "Yesterday, 2:00 AM",
      nextRun: "Today, 2:00 AM",
      status: false,
    },
    {
      id: "4",
      name: "API Health Check",
      schedule: "*/30 * * * *",
      lastRun: "5 mins ago",
      nextRun: "In 25 mins",
      status: true,
    },
  ]);

  const toggleStatus = (id: string) => {
    setCrons((prev) =>
      prev.map((cron) =>
        cron.id === id ? { ...cron, status: !cron.status } : cron,
      ),
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Cron Jobs</h1>
        <p className="text-[#8b8fa8]">Manage scheduled tasks and automations</p>
      </div>

      <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2a2d3e] bg-[#252840]">
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#8b8fa8]">
                Name
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#8b8fa8]">
                Schedule
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#8b8fa8]">
                Last Run
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#8b8fa8]">
                Next Run
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-[#8b8fa8]">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {crons.map((cron) => (
              <tr
                key={cron.id}
                className="border-b border-[#2a2d3e] hover:bg-[#252840] transition-colors duration-150 last:border-b-0"
              >
                <td className="px-6 py-4 text-sm text-white font-medium">
                  {cron.name}
                </td>
                <td className="px-6 py-4 text-sm text-[#8b8fa8] font-mono">
                  {cron.schedule}
                </td>
                <td className="px-6 py-4 text-sm text-[#8b8fa8]">
                  {cron.lastRun}
                </td>
                <td className="px-6 py-4 text-sm text-[#8b8fa8]">
                  {cron.nextRun}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleStatus(cron.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-150 ${
                      cron.status ? "bg-green-600" : "bg-[#2a2d3e]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-150 ${
                        cron.status ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Crons;
