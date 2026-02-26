import { useState } from "react";
import TaskRow from "@/components/TaskRow";
import { IconChecklist } from "@tabler/icons-react";

interface Task {
  id: string;
  name: string;
  status: "pending" | "running" | "complete" | "failed";
  timestamp: Date;
  description?: string;
  output?: string;
}

export function Tasks() {
  const [tasks] = useState<Task[]>([
    {
      id: "1",
      name: "Process email inbox",
      status: "complete",
      timestamp: new Date(Date.now() - 3600000),
      description: "Processed and categorized 25 emails",
      output:
        "Successfully archived 10 emails, moved 5 to follow-up, and delegated 3.",
    },
    {
      id: "2",
      name: "Calendar optimization",
      status: "running",
      timestamp: new Date(),
      description: "Analyzing your calendar for optimization opportunities",
    },
    {
      id: "3",
      name: "Daily briefing generation",
      status: "pending",
      timestamp: new Date(Date.now() + 3600000),
    },
  ]);

  return (
    <div className="p-6 bg-[#0a0a0a] min-h-screen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-white">Tasks</h1>
        <p className="text-gray-400 mt-2">
          Track all your assistant's tasks and activities
        </p>
      </div>

      <div className="bg-[#111] border border-[#1a1a1a] rounded-lg overflow-hidden">
        {tasks.length > 0 ? (
          <div>
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                taskId={task.id}
                icon={<IconChecklist size={20} />}
                taskName={task.name}
                status={task.status}
                timestamp={task.timestamp}
                description={task.description}
                output={task.output}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-400">No tasks yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Tasks;
