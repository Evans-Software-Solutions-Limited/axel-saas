import React from "react";
import { Badge } from "./ui/badge";

type StatusType =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "active"
  | "disabled"
  | "idle"
  | "error";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  pulse = false,
}) => {
  const statusMap: Record<StatusType, { variant: any; defaultLabel: string }> =
    {
      pending: { variant: "secondary", defaultLabel: "Pending" },
      running: { variant: "default", defaultLabel: "Running" },
      complete: { variant: "success", defaultLabel: "Complete" },
      failed: { variant: "destructive", defaultLabel: "Failed" },
      active: { variant: "success", defaultLabel: "Active" },
      disabled: { variant: "secondary", defaultLabel: "Disabled" },
      idle: { variant: "secondary", defaultLabel: "Idle" },
      error: { variant: "destructive", defaultLabel: "Error" },
    };

  const { variant, defaultLabel } = statusMap[status];
  const displayLabel = label || defaultLabel;

  return (
    <Badge
      variant={variant}
      className={`${pulse && status === "running" ? "animate-pulse" : ""}`}
    >
      {pulse && status === "running" && (
        <span className="w-2 h-2 bg-current rounded-full mr-2" />
      )}
      {displayLabel}
    </Badge>
  );
};

export default StatusBadge;
