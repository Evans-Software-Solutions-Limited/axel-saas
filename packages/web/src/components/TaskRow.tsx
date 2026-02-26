import React, { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import StatusBadge from "./StatusBadge";

type TaskStatus = "pending" | "running" | "complete" | "failed";

interface TaskRowProps {
  taskId?: string;
  icon: React.ReactNode;
  taskName: string;
  status: TaskStatus;
  timestamp: Date;
  description?: string;
  output?: string;
}

const TaskRow: React.FC<TaskRowProps> = ({
  icon,
  taskName,
  status,
  timestamp,
  description,
  output,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const timeString = timestamp.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const canExpand = description || output;

  return (
    <>
      <button
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[#1a1a1a]/50 transition-colors text-left border-b border-[#2a2a2a] last:border-b-0"
      >
        <div className="flex-shrink-0 text-gray-400">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{taskName}</p>
        </div>
        <div className="flex-shrink-0">
          <StatusBadge status={status} pulse={status === "running"} />
        </div>
        <div className="flex-shrink-0 text-xs text-gray-500">{timeString}</div>
        {canExpand && (
          <IconChevronDown
            size={20}
            className={`flex-shrink-0 text-gray-400 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        )}
      </button>

      {isExpanded && canExpand && (
        <div className="bg-[#1a1a1a]/30 border-b border-[#2a2a2a] p-4 space-y-4">
          {description && (
            <div>
              <p className="text-sm text-gray-400">{description}</p>
            </div>
          )}
          {output && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Output:
              </p>
              <pre className="bg-[#0a0a0a] border border-[#2a2a2a] rounded p-3 text-xs text-gray-400 overflow-x-auto max-h-48 overflow-y-auto">
                {output}
              </pre>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default TaskRow;
