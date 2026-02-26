import React from "react";
import { Switch } from "./ui/switch";
import StatusBadge from "./StatusBadge";

type CronStatus = "active" | "disabled" | "error";

interface CronRowProps {
  cronId: string;
  name: string;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  status: CronStatus;
  onToggleEnabled: (enabled: boolean) => void;
}

const CronRow: React.FC<CronRowProps> = ({
  name,
  schedule,
  lastRun,
  nextRun,
  status,
  onToggleEnabled,
}) => {
  const isActive = status === "active";
  const lastRunStr = lastRun
    ? lastRun.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Never";

  const nextRunStr = nextRun
    ? nextRun.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "N/A";

  return (
    <tr className="border-b border-[#2a2a2a] hover:bg-[#1a1a1a]/30 transition-colors">
      <td className="px-4 py-4 font-medium text-white">{name}</td>
      <td className="px-4 py-4 text-sm text-gray-400">{schedule}</td>
      <td className="px-4 py-4 text-sm text-gray-500">{lastRunStr}</td>
      <td className="px-4 py-4 text-sm text-gray-500">{nextRunStr}</td>
      <td className="px-4 py-4">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-4">
        <Switch
          checked={isActive}
          onCheckedChange={onToggleEnabled}
          disabled={status === "error"}
        />
      </td>
    </tr>
  );
};

export default CronRow;
