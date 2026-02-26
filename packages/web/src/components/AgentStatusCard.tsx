import React from "react";
import { Card } from "./ui/card";

type StatusType = "available" | "pending" | "working" | "unavailable";

interface AgentStatusCardProps {
  agentName: string;
  status: StatusType;
  currentTask?: string;
  lastActiveTime?: Date;
}

const AgentStatusCard: React.FC<AgentStatusCardProps> = ({
  agentName,
  status,
  currentTask,
  lastActiveTime,
}) => {
  const statusDotColors: Record<StatusType, string> = {
    available: "bg-green-500",
    pending: "bg-amber-500",
    working: "bg-blue-500 animate-pulse",
    unavailable: "bg-red-500",
  };

  const statusLabels: Record<StatusType, string> = {
    available: "Available",
    pending: "Pending",
    working: "Working",
    unavailable: "Unavailable",
  };

  const lastActiveText = lastActiveTime
    ? lastActiveTime.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Never";

  return (
    <Card className="p-4 bg-[#111] border-[#1a1a1a] hover:border-blue-400/50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-bold text-white">{agentName}</h4>
          <div className="flex items-center gap-2 mt-2">
            <div
              className={`w-2 h-2 rounded-full ${statusDotColors[status]}`}
            />
            <span className="text-sm text-gray-400">
              {statusLabels[status]}
            </span>
          </div>
          {currentTask && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              Current: {currentTask}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Last active</p>
          <p className="text-sm font-medium text-gray-400">{lastActiveText}</p>
        </div>
      </div>
    </Card>
  );
};

export default AgentStatusCard;
