import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";

interface Task {
  id: string;
  name: string;
  agent: string;
  description: string;
  status: "pending" | "running" | "complete" | "failed";
  startTime: string;
  endTime?: string;
  expanded?: boolean;
}

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      name: "Process Email Queue",
      agent: "Email Agent",
      description: "Processing 45 incoming emails",
      status: "running",
      startTime: "2:30 PM",
    },
    {
      id: "2",
      name: "Generate Weekly Report",
      agent: "Report Builder",
      description: "Creating summary from last 7 days",
      status: "pending",
      startTime: "3:00 PM",
    },
    {
      id: "3",
      name: "Sync Database",
      agent: "Data Sync",
      description: "Syncing 1,200 records",
      status: "complete",
      startTime: "1:45 PM",
      endTime: "2:15 PM",
    },
    {
      id: "4",
      name: "API Health Check",
      agent: "API Manager",
      description: "Monitoring 12 endpoints",
      status: "failed",
      startTime: "2:00 PM",
    },
  ]);

  const toggleExpanded = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, expanded: !task.expanded } : task,
      ),
    );
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: "bg-zinc-500/20",
          text: "text-zinc-300",
          label: "Pending",
        };
      case "running":
        return {
          bg: "bg-blue-500/20",
          text: "text-blue-300",
          label: "Running",
        };
      case "complete":
        return {
          bg: "bg-green-500/20",
          text: "text-green-300",
          label: "Complete",
        };
      case "failed":
        return {
          bg: "bg-red-500/20",
          text: "text-red-300",
          label: "Failed",
        };
      default:
        return { bg: "", text: "", label: status };
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-2">Tasks</h1>
        <p className="text-[#8b8fa8]">Monitor and manage your agent tasks</p>
      </div>

      <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl overflow-hidden">
        <div className="space-y-0">
          {tasks.map((task) => {
            const styles = getStatusBadgeStyles(task.status);
            return (
              <div
                key={task.id}
                className="border-b border-[#2a2d3e] last:border-b-0 transition-colors duration-150 hover:bg-[#252840]"
              >
                <button
                  onClick={() => toggleExpanded(task.id)}
                  className="w-full p-4 flex items-center gap-4 text-left"
                >
                  <IconChevronDown
                    size={20}
                    className={`text-[#8b8fa8] transition-transform ${
                      task.expanded ? "rotate-180" : ""
                    }`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-white">{task.name}</h3>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded ${styles.bg} ${styles.text}`}
                      >
                        {styles.label}
                      </span>
                    </div>
                    <p className="text-sm text-[#8b8fa8] mt-1">{task.agent}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-[#8b8fa8]">{task.startTime}</p>
                  </div>
                </button>

                {task.expanded && (
                  <div className="bg-[#252840] px-4 py-4 border-t border-[#2a2d3e]">
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-[#8b8fa8]">Description:</span>
                        <p className="text-white mt-1">{task.description}</p>
                      </div>
                      {task.endTime && (
                        <div>
                          <span className="text-[#8b8fa8]">Duration:</span>
                          <p className="text-white mt-1">
                            {task.startTime} - {task.endTime}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Tasks;
