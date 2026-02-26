import { useState } from "react";
import { IconList, IconNetwork } from "@tabler/icons-react";
import AgentStatusCard from "@/components/AgentStatusCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Agent {
  id: string;
  name: string;
  status: "available" | "pending" | "unavailable" | "working";
  currentTask?: string;
}

interface Task {
  id: string;
  title: string;
  summary: string;
  project: string;
}

const MOCK_AGENTS: Agent[] = [
  {
    id: "1",
    name: "Main Agent - Axel",
    status: "available",
    currentTask: "Available",
  },
  {
    id: "2",
    name: "Email Agent",
    status: "working",
    currentTask: "Processing inbox...",
  },
  {
    id: "3",
    name: "Research Agent",
    status: "available",
    currentTask: "Available",
  },
];

const MOCK_TASKS: Task[] = [
  {
    id: "1",
    title: "Review quarterly reports",
    summary: "Analyze Q1 financial reports and generate insights",
    project: "LettingsOps",
  },
  {
    id: "2",
    title: "Schedule team sync",
    summary: "Find 1-hour slot for team standup this week",
    project: "Persistence",
  },
  {
    id: "3",
    title: "Draft proposal response",
    summary: "Write response to client proposal with cost estimates",
    project: "LettingsOps",
  },
];

const STATUS_COLORS = {
  available: "bg-green-500",
  pending: "bg-amber-500",
  unavailable: "bg-red-500",
  working: "bg-blue-500",
};

const STATUS_LABELS = {
  available: "🟢 Available",
  pending: "🟠 Pending",
  unavailable: "🔴 Unavailable",
  working: "⟳ Working",
};

export function Office() {
  const [view, setView] = useState<"list" | "diagram">("list");

  return (
    <div className="p-6 bg-[#0a0a0a] min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-4">Office</h1>
        <p className="text-gray-400 mb-6">
          Monitor your agents and manage tasks
        </p>

        {/* View toggle */}
        <div className="flex gap-2">
          <Button
            onClick={() => setView("list")}
            variant={view === "list" ? "default" : "outline"}
            className={view === "list" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <IconList size={18} className="mr-2" />
            List
          </Button>
          <Button
            onClick={() => setView("diagram")}
            variant={view === "diagram" ? "default" : "outline"}
            className={
              view === "diagram" ? "bg-blue-600 hover:bg-blue-700" : ""
            }
          >
            <IconNetwork size={18} className="mr-2" />
            Diagram
          </Button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Main content */}
        <div className="flex-1">
          {view === "list" ? (
            <div className="space-y-4">
              {MOCK_AGENTS.map((agent) => (
                <AgentStatusCard
                  key={agent.id}
                  agentName={agent.name}
                  status={agent.status}
                  currentTask={agent.currentTask}
                  lastActiveTime={
                    new Date(Date.now() - Math.random() * 3600000)
                  }
                />
              ))}
            </div>
          ) : (
            /* Diagram view */
            <div className="bg-[#111] rounded-lg border border-[#1a1a1a] p-8">
              <div className="grid grid-cols-3 gap-8">
                {MOCK_AGENTS.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex flex-col items-center gap-4"
                  >
                    {/* Node */}
                    <div className="relative">
                      {/* Status ring */}
                      <div
                        className={`absolute -inset-2 rounded-full ${
                          STATUS_COLORS[agent.status]
                        } opacity-20`}
                      />

                      {/* Avatar */}
                      <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold border-2 border-[#1a1a1a]">
                        {agent.name.charAt(0)}
                        {agent.status === "working" && (
                          <div className="absolute inset-0 rounded-full animate-spin border-2 border-transparent border-t-blue-400 border-r-blue-400" />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="text-center">
                      <h3 className="font-semibold text-white text-sm">
                        {agent.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        {STATUS_LABELS[agent.status]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Task sidebar */}
        <div className="w-80">
          <div className="rounded-lg border border-[#1a1a1a] bg-[#111] p-6">
            <h2 className="text-lg font-bold text-white mb-4">
              Unassigned Tasks
            </h2>

            <div className="space-y-3">
              {MOCK_TASKS.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="font-semibold text-white flex-1">
                      {task.title}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {task.project}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400 mb-3">{task.summary}</p>
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    Start task
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Office;
