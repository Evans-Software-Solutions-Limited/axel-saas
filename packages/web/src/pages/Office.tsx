import * as React from "react";
import { useNavigate } from "react-router";
import { Badge } from "@axel-saas/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@axel-saas/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@axel-saas/ui/tabs";
import { useAgentTasks, type AgentDerivedStatus } from "@/hooks/useAgentTasks";
import type { TaskListItem } from "@/pages/tasks/tasksApi";
import type { TaskState } from "@/pages/tasks/tasksApi";

const statusColours: Record<AgentDerivedStatus, string> = {
  idle: "bg-success",
  busy: "bg-warning",
  working: "bg-destructive",
};

const statusGlow: Record<AgentDerivedStatus, string> = {
  idle: "",
  busy: "drop-shadow(0 0 6px rgba(251,191,36,0.9))",
  working: "drop-shadow(0 0 6px rgba(248,113,113,0.9))",
};

/** Sprite height as fraction of the scene container height (0.12 = 12%). */
const SPRITE_HEIGHT_RATIO = 0.12;

const DeskPositions = [
  { top: "36%", left: "20.5%" },
  { top: "36%", left: "39%" },
  { top: "36%", left: "56.5%" },
  { top: "36%", left: "76.5%" },
  { top: "90%", left: "24%" },
  { top: "90%", left: "57%" },
  { top: "90%", left: "85%" },
];

const taskStatusColours: Record<TaskState, string> = {
  running: "bg-warning/15 text-warning",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  review_ready: "bg-accent-muted text-accent",
  no_changes: "bg-muted/15 text-text-secondary",
  unknown: "bg-muted/15 text-text-secondary",
};

const taskStatusLabels: Record<TaskState, string> = {
  running: "In Progress",
  completed: "Completed",
  failed: "Failed",
  review_ready: "Review Ready",
  no_changes: "No Changes",
  unknown: "Pending",
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "Just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface OfficeProps {
  readonly onQuickChat?: () => void;
}

type ViewMode = "desk" | "list";

export function Office({ onQuickChat }: OfficeProps) {
  const navigate = useNavigate();
  const { agents, loading, error } = useAgentTasks();
  const [viewMode, setViewMode] = React.useState<ViewMode>("desk");
  const [activeAgent, setActiveAgent] = React.useState<string | undefined>(
    undefined,
  );
  const [sceneHeightPx, setSceneHeightPx] = React.useState(0);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const accordionRef = React.useRef<HTMLDivElement>(null);

  const handleQuickChat = React.useCallback(() => {
    if (onQuickChat) {
      onQuickChat();
      return;
    }
    navigate("/dashboard/chat");
  }, [navigate, onQuickChat]);

  const spriteHeightPx = Math.max(
    40,
    Math.min(120, sceneHeightPx * SPRITE_HEIGHT_RATIO),
  );

  React.useEffect(() => {
    if (viewMode !== "desk") return;
    const el = sceneRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { height } = entries[0]?.contentRect ?? {};
      if (typeof height === "number") setSceneHeightPx(height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]);

  function handleAgentClick(agentId: string) {
    setActiveAgent(agentId);
    setViewMode("list");
    setTimeout(() => {
      accordionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function handleTabChange(value: string) {
    const mode = value as ViewMode;
    setViewMode(mode);
    if (mode === "list" && !activeAgent && agents.length > 0) {
      setActiveAgent(agents[0].metadata.id);
    }
  }

  const hasAnyActivity = agents.some((a) => a.tasks.length > 0);
  const positionedAgents = agents.map((agent, i) => ({
    ...agent,
    scenePosition: DeskPositions[Math.min(i, DeskPositions.length - 1)],
  }));

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      <Tabs
        value={viewMode}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0 w-full"
      >
        <TabsList variant="line" className="mb-4 w-fit shrink-0">
          <TabsTrigger
            value="desk"
            className={
              viewMode === "desk"
                ? "font-semibold text-accent border-b-2 border-accent rounded-none pb-1.5 -mb-px font-display"
                : "text-text-secondary font-display"
            }
          >
            Desk view
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className={
              viewMode === "list"
                ? "font-semibold text-accent border-b-2 border-accent rounded-none pb-1.5 -mb-px font-display"
                : "text-text-secondary font-display"
            }
          >
            List view
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="mt-0 flex-1 min-h-0 flex flex-col">
          <div
            ref={sceneRef}
            className="relative w-full flex-1 min-h-0 overflow-hidden rounded-2xl border border-border-subtle bg-transparent"
          >
            <img
              src="/pixel-office-bg.png"
              alt="AI Office"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ imageRendering: "pixelated" }}
              draggable={false}
            />
            {positionedAgents.map((agent) => {
              const isActive = activeAgent === agent.metadata.id;
              return (
                <button
                  key={agent.metadata.id}
                  type="button"
                  className="absolute cursor-pointer group z-10 bg-transparent border-0 p-0 focus:outline-none flex flex-col items-center"
                  style={{
                    top: agent.scenePosition.top,
                    left: agent.scenePosition.left,
                    transform: "translate(-50%, -100%)",
                  }}
                  onClick={() => handleAgentClick(agent.metadata.id)}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-raised/95 backdrop-blur-xl text-white text-xs p-3 rounded-xl shadow-xl z-20 min-w-44 border border-border-accent pointer-events-none">
                    <div className="font-semibold">{agent.metadata.name}</div>
                    <div className="text-white/60 mb-1 text-[10px]">
                      {agent.metadata.role}
                    </div>
                    <div className="text-white/90">
                      {agent.currentTask ?? "Ready and waiting"}
                    </div>
                    <div className="text-white/40 mt-1 text-[10px]">
                      Last active: {formatRelative(agent.lastActiveAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1 bg-surface-raised/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border-accent">
                    <div className="relative shrink-0">
                      <div
                        className={`w-2 h-2 rounded-full ${statusColours[agent.status]}`}
                      />
                      {agent.status !== "idle" && (
                        <div
                          className={`absolute inset-0 rounded-full ${statusColours[agent.status]} animate-ping opacity-75`}
                        />
                      )}
                    </div>
                    <span className="text-white text-[10px] whitespace-nowrap leading-tight">
                      {agent.metadata.name}
                    </span>
                  </div>
                  <img
                    src={agent.metadata.spriteImage}
                    alt={agent.metadata.name}
                    style={{
                      height: spriteHeightPx,
                      width: "auto",
                      imageRendering: "pixelated",
                      filter: isActive
                        ? "drop-shadow(0 0 8px rgba(255,255,255,0.9))"
                        : statusGlow[agent.status] || undefined,
                      transition: "filter 0.2s ease",
                    }}
                    draggable={false}
                  />
                </button>
              );
            })}

            {!loading && !hasAnyActivity && (
              <div className="absolute inset-x-0 bottom-20 flex flex-col items-center gap-2 text-center pointer-events-none">
                <div className="bg-surface-raised/90 backdrop-blur-xl px-4 py-3 rounded-xl border border-border-accent pointer-events-auto max-w-sm">
                  <div className="font-display font-semibold text-text mb-1">
                    Axel is ready and waiting.
                  </div>
                  <p className="text-sm text-text-secondary mb-3">
                    Start a conversation to put your assistant to work.
                  </p>
                  <button
                    type="button"
                    onClick={handleQuickChat}
                    className="text-sm text-accent font-medium hover:underline"
                  >
                    Go to Chat →
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive/15 text-destructive text-xs px-3 py-1.5 rounded-full border border-destructive/30"
              >
                {error}
              </div>
            )}

            <button
              className="absolute bottom-4 right-4 z-10 bg-surface-raised/80 backdrop-blur-xl hover:bg-surface-elevated text-text text-sm px-4 py-2 rounded-full shadow-lg border border-border-accent transition-all duration-200 cursor-pointer hover:shadow-[0_0_20px_-4px_var(--color-accent-glow)]"
              onClick={handleQuickChat}
            >
              💬 Quick Chat
            </button>
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-0 flex-1 min-h-0 overflow-auto">
          <div ref={accordionRef}>
            <Accordion
              type="single"
              collapsible
              value={activeAgent}
              onValueChange={setActiveAgent}
              className="w-full"
            >
              {agents.map((agent) => (
                <AccordionItem
                  key={agent.metadata.id}
                  value={agent.metadata.id}
                  id={`agent-${agent.metadata.id}`}
                >
                  <AccordionTrigger className="hover:no-underline px-2">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${agent.metadata.avatarColour}`}
                      >
                        {agent.metadata.name[0]}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-semibold text-sm">
                          {agent.metadata.name}
                        </span>
                        <span className="text-text-secondary text-sm ml-2">
                          {agent.metadata.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mr-2">
                        <div
                          className={`w-2 h-2 rounded-full ${statusColours[agent.status]}`}
                        />
                        <span className="text-xs text-text-secondary capitalize">
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="flex gap-3 mb-4 flex-wrap">
                      <div className="glass-card rounded-xl px-4 py-2.5 text-center min-w-20">
                        <div className="text-lg font-bold">
                          {agent.stats.totalTasks}
                        </div>
                        <div className="text-xs text-text-secondary">
                          Total tasks
                        </div>
                      </div>
                      <div className="glass-card rounded-xl px-4 py-2.5 text-center min-w-20">
                        <div className="text-lg font-bold">
                          {agent.stats.todayTasks}
                        </div>
                        <div className="text-xs text-text-secondary">Today</div>
                      </div>
                      <div className="glass-card rounded-xl px-4 py-2.5 text-center min-w-20">
                        <div className="text-sm font-semibold">
                          {agent.stats.avgDuration || "—"}
                        </div>
                        <div className="text-xs text-text-secondary">
                          Avg duration
                        </div>
                      </div>
                    </div>
                    {agent.tasks.length === 0 ? (
                      <div className="py-4 text-sm text-text-secondary">
                        No tasks yet. Start a conversation to get going.
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {agent.tasks.slice(0, 5).map((job: TaskListItem) => (
                          <div
                            key={job.id}
                            className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0"
                          >
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                            >
                              {agent.metadata.name}
                            </Badge>
                            <span className="text-sm flex-1 min-w-0 truncate">
                              {job.taskSummary ?? "(no summary)"}
                            </span>
                            <span className="text-xs text-text-secondary shrink-0 hidden sm:block">
                              {formatRelative(job.createdAt)}
                            </span>
                            <Badge
                              className={`text-xs shrink-0 border-0 ${taskStatusColours[job.state]}`}
                            >
                              {taskStatusLabels[job.state]}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
