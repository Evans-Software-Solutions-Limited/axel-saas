import { useState } from "react";
import { Card } from "@axel-saas/ui/card";
import { Input } from "@axel-saas/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@axel-saas/ui/select";
import { Badge } from "@axel-saas/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@axel-saas/ui/table";
import { IconSearch } from "@tabler/icons-react";

// ============================================================================
// TASKS TAB
// ============================================================================

interface Task {
  id: string;
  name: string;
  agent: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  dueDate: string;
}

const SAMPLE_TASKS: Task[] = [
  {
    id: "1",
    name: "Process email inbox",
    agent: "Axel",
    status: "in-progress",
    dueDate: "Today",
  },
  {
    id: "2",
    name: "Generate weekly report",
    agent: "Automata",
    status: "completed",
    dueDate: "Yesterday",
  },
  {
    id: "3",
    name: "Index new documents",
    agent: "Keeper",
    status: "pending",
    dueDate: "Tomorrow",
  },
  {
    id: "4",
    name: "Update client files",
    agent: "Axel",
    status: "failed",
    dueDate: "3 days ago",
  },
];

const statusColors = {
  pending: "bg-muted/20 text-muted",
  "in-progress": "bg-accent/20 text-accent",
  completed: "bg-success/20 text-success",
  failed: "bg-destructive/20 text-destructive",
};

const statusLabels = {
  pending: "Pending",
  "in-progress": "In Progress",
  completed: "Completed",
  failed: "Failed",
};

export function Tasks() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = SAMPLE_TASKS.filter((task) => {
    const matchesSearch = task.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-xl font-semibold text-text tracking-tight">Tasks</h1>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/60" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 bg-surface border-border/60 text-text h-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-surface border-border/60 text-text h-10">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-surface-raised border-border/60">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <Card className="border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
              <TableHead className="text-muted/70 text-xs font-medium uppercase tracking-wider">
                Task
              </TableHead>
              <TableHead className="text-muted/70 text-xs font-medium uppercase tracking-wider">
                Agent
              </TableHead>
              <TableHead className="text-muted/70 text-xs font-medium uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="text-muted/70 text-xs font-medium uppercase tracking-wider">
                Due Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((task) => (
              <TableRow
                key={task.id}
                className="border-border/30 hover:bg-surface-elevated/30"
              >
                <TableCell className="text-text font-medium text-sm">
                  {task.name}
                </TableCell>
                <TableCell className="text-muted text-sm">
                  {task.agent}
                </TableCell>
                <TableCell>
                  <Badge
                    className={`${statusColors[task.status as keyof typeof statusColors]} border-0 text-xs`}
                  >
                    {statusLabels[task.status as keyof typeof statusLabels]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted text-sm">
                  {task.dueDate}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
