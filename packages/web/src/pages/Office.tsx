import {
  IconUsers,
  IconCircleFilled,
  IconCheck,
  IconClock,
} from "@tabler/icons-react";

export function Office() {
  // Mock agents
  const agents = [
    {
      id: 1,
      name: "Email Agent",
      status: "active",
      task: "Processing emails",
      emoji: "📧",
    },
    {
      id: 2,
      name: "Scheduler",
      status: "idle",
      task: "Awaiting tasks",
      emoji: "📅",
    },
    {
      id: 3,
      name: "Data Sync",
      status: "processing",
      task: "Syncing databases",
      emoji: "🔄",
    },
    {
      id: 4,
      name: "Report Builder",
      status: "idle",
      task: "Awaiting tasks",
      emoji: "📊",
    },
    {
      id: 5,
      name: "API Manager",
      status: "active",
      task: "Monitoring APIs",
      emoji: "🔌",
    },
    {
      id: 6,
      name: "Content Bot",
      status: "processing",
      task: "Generating content",
      emoji: "✍️",
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "#22c55e";
      case "processing":
        return "#f59e0b";
      case "idle":
        return "#8b8fa8";
      default:
        return "#8b8fa8";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "processing":
        return "Processing";
      case "idle":
        return "Idle";
      default:
        return status;
    }
  };

  // Mock data
  const tasks = [
    {
      id: 1,
      name: "Email Campaign",
      agent: "Email Agent",
      status: "completed",
      dueDate: "Today",
    },
    {
      id: 2,
      name: "Database Sync",
      agent: "Data Sync",
      status: "in-progress",
      dueDate: "Today",
    },
    {
      id: 3,
      name: "Weekly Report",
      agent: "Report Builder",
      status: "pending",
      dueDate: "Tomorrow",
    },
  ];

  const notifications = [
    { id: 1, message: "Email Agent completed 5 emails", time: "2m ago" },
    { id: 2, message: "Scheduler has 3 pending tasks", time: "10m ago" },
    { id: 3, message: "API Manager detected 1 alert", time: "1h ago" },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#8b8fa8] text-sm font-medium">
                Online Active
              </p>
              <p className="text-3xl font-bold text-white mt-2">3</p>
              <p className="text-xs text-[#8b8fa8] mt-1">Agents</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <IconUsers size={24} className="text-indigo-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#8b8fa8] text-sm font-medium">
                Ongoing Tasks
              </p>
              <p className="text-3xl font-bold text-white mt-2">7</p>
              <p className="text-xs text-[#8b8fa8] mt-1">In Progress</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <IconClock size={24} className="text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#8b8fa8] text-sm font-medium">
                Completed Tasks
              </p>
              <p className="text-3xl font-bold text-white mt-2">14</p>
              <p className="text-xs text-[#8b8fa8] mt-1">Finished</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center">
              <IconCheck size={24} className="text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#8b8fa8] text-sm font-medium">Idle</p>
              <p className="text-3xl font-bold text-white mt-2">2</p>
              <p className="text-xs text-[#8b8fa8] mt-1">Agents</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-slate-500/20 flex items-center justify-center">
              <IconCircleFilled size={24} className="text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Virtual Office */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-6">
          Virtual Office
        </h2>
        <div className="bg-[#1a1d2e] rounded-xl p-8">
          <div className="grid grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-[#252840] border border-[#2a2d3e] rounded-xl p-5 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-indigo-500/30 flex items-center justify-center text-3xl font-bold mb-3">
                  {agent.emoji}
                </div>
                <p className="text-sm font-semibold text-white">{agent.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getStatusColor(agent.status) }}
                  />
                  <span className="text-xs text-[#8b8fa8]">
                    {getStatusLabel(agent.status)} — {agent.task}
                  </span>
                </div>
                <p className="text-xs text-[#8b8fa8] mt-1 truncate w-full">
                  {agent.task}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Panels */}
      <div className="grid grid-cols-3 gap-6">
        {/* Task Overview */}
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Task Overview
          </h3>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-[#252840] rounded-lg"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{task.name}</p>
                  <p className="text-xs text-[#8b8fa8]">{task.agent}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium px-2 py-1 rounded"
                    style={{
                      backgroundColor:
                        task.status === "completed"
                          ? "rgba(34, 197, 94, 0.2)"
                          : task.status === "in-progress"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(107, 114, 128, 0.2)",
                      color:
                        task.status === "completed"
                          ? "#22c55e"
                          : task.status === "in-progress"
                            ? "#f59e0b"
                            : "#9ca3af",
                    }}
                  >
                    {task.status === "completed"
                      ? "Done"
                      : task.status === "in-progress"
                        ? "Running"
                        : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Notifications
          </h3>
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div key={notif.id} className="p-3 bg-[#252840] rounded-lg">
                <p className="text-sm text-white">{notif.message}</p>
                <p className="text-xs text-[#8b8fa8] mt-1">{notif.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-[#1e2130] border border-[#2a2d3e] rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Quick Actions
          </h3>
          <div className="space-y-3">
            <button className="w-full bg-indigo-500 text-white py-2 rounded-lg font-medium hover:bg-indigo-600 transition-colors duration-150">
              Create Task
            </button>
            <button className="w-full bg-[#252840] text-white py-2 rounded-lg font-medium hover:bg-[#2d3050] transition-colors duration-150">
              Add Agent
            </button>
            <button className="w-full bg-[#252840] text-white py-2 rounded-lg font-medium hover:bg-[#2d3050] transition-colors duration-150">
              View Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Office;
