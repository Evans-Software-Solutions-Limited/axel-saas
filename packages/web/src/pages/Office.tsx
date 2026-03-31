import * as React from "react";
import { Badge } from "@axel-saas/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@axel-saas/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@axel-saas/ui/tabs";

type AgentStatus = "idle" | "busy" | "working" | "special";

interface RecentJob {
  type: string;
  description: string;
  time: string;
  status: "Completed" | "In Progress" | "Failed";
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask: string;
  lastActive: string;
  /** Position in the office scene as percentage of the container */
  scenePosition: { top: string; left: string };
  /** Path to the individual character sprite image (transparent PNG). */
  spriteImage: string;
  avatarColour: string;
  stats: {
    totalTasks: number;
    todayTasks: number;
    avgDuration: string;
  };
  recentJobs: RecentJob[];
}

const statusColours: Record<AgentStatus, string> = {
  idle: "bg-success",
  busy: "bg-warning",
  working: "bg-destructive",
  special: "bg-purple-400",
};

const statusGlow: Record<AgentStatus, string> = {
  idle: "",
  busy: "drop-shadow(0 0 6px rgba(251,191,36,0.9))",
  working: "drop-shadow(0 0 6px rgba(248,113,113,0.9))",
  special: "drop-shadow(0 0 6px rgba(168,85,247,0.9))",
};

/** Sprite height as fraction of the scene container height (0.15 = 15%). */
const SPRITE_HEIGHT_RATIO = 0.12;

const jobStatusColours: Record<RecentJob["status"], string> = {
  Completed: "bg-success/15 text-success",
  "In Progress": "bg-warning/15 text-warning",
  Failed: "bg-destructive/15 text-destructive",
};

const DeskPositions = [
  {
    top: "36%",
    left: "20.5%",
  },
  {
    top: "36%",
    left: "39%",
  },
  {
    top: "36%",
    left: "56.5%",
  },
  {
    top: "36%",
    left: "76.5%",
  },
  {
    top: "90%",
    left: "24%",
  },
  {
    top: "90%",
    left: "57%",
  },
  {
    top: "90%",
    left: "85%",
  },
];

const agents: Agent[] = [
  {
    id: "axel",
    name: "Axel",
    role: "Chief Task Handler",
    status: "idle",
    currentTask: "Ready and waiting",
    lastActive: "Just now",
    scenePosition: DeskPositions[0],
    spriteImage: "/sprites/sprite-axel.png",
    avatarColour: "bg-accent-strong",
    stats: { totalTasks: 142, todayTasks: 7, avgDuration: "2m 14s" },
    recentJobs: [
      {
        type: "Email",
        description: "Replied to viewing enquiry from sarah@gmail.com",
        time: "Today, 14:23",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Summarised weekly leads report",
        time: "Today, 11:05",
        status: "Completed",
      },
      {
        type: "Doc",
        description: "Drafted tenancy agreement for 12 Oak Street",
        time: "Yesterday",
        status: "Completed",
      },
      {
        type: "Email",
        description: "Processed maintenance request from tenant",
        time: "Yesterday",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Qualified new lead: James Whitfield",
        time: "2 days ago",
        status: "Completed",
      },
    ],
  },
  {
    id: "scribe",
    name: "Scribe",
    role: "Document Writer",
    status: "working",
    currentTask: "Drafting tenancy agreement",
    lastActive: "1 min ago",
    scenePosition: DeskPositions[1],
    spriteImage: "/sprites/sprite-scribe.png",
    avatarColour: "bg-emerald-500",
    stats: { totalTasks: 38, todayTasks: 3, avgDuration: "5m 40s" },
    recentJobs: [
      {
        type: "Doc",
        description: "Tenancy agreement — 12 Oak Street",
        time: "Now",
        status: "In Progress",
      },
      {
        type: "Doc",
        description: "Reference letter for Tom Brady",
        time: "Today, 10:00",
        status: "Completed",
      },
      {
        type: "Doc",
        description: "Inventory report — Flat 4B",
        time: "Yesterday",
        status: "Completed",
      },
      {
        type: "Doc",
        description: "Viewing confirmation email template",
        time: "3 days ago",
        status: "Completed",
      },
      {
        type: "Doc",
        description: "Monthly newsletter draft",
        time: "4 days ago",
        status: "Completed",
      },
    ],
  },
  {
    id: "relay",
    name: "Relay",
    role: "Comms Manager",
    status: "busy",
    currentTask: "Processing 3 emails",
    lastActive: "30s ago",
    scenePosition: DeskPositions[2],
    spriteImage: "/sprites/sprite-relay.png",
    avatarColour: "bg-violet-500",
    stats: { totalTasks: 291, todayTasks: 12, avgDuration: "45s" },
    recentJobs: [
      {
        type: "Email",
        description: "Auto-replied to 3 viewing enquiries",
        time: "Just now",
        status: "In Progress",
      },
      {
        type: "Email",
        description: "Sent qualification follow-up to Mark Chen",
        time: "Today, 13:55",
        status: "Completed",
      },
      {
        type: "Call",
        description: "Handled inbound call — 07712 345678",
        time: "Today, 12:30",
        status: "Completed",
      },
      {
        type: "Email",
        description: "Forwarded maintenance request to contractor",
        time: "Today, 09:15",
        status: "Completed",
      },
      {
        type: "Email",
        description: "Sent viewing confirmation to Lisa Park",
        time: "Yesterday",
        status: "Completed",
      },
    ],
  },
  {
    id: "keeper",
    name: "Keeper",
    role: "Knowledge Manager",
    status: "idle",
    currentTask: "Ready and waiting",
    lastActive: "1 hour ago",
    scenePosition: DeskPositions[3],
    spriteImage: "/sprites/sprite-keeper.png",
    avatarColour: "bg-amber-500",
    stats: { totalTasks: 19, todayTasks: 1, avgDuration: "8m 20s" },
    recentJobs: [
      {
        type: "Task",
        description: "Indexed updated tenancy policy document",
        time: "Today, 08:00",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Updated compliance knowledge base",
        time: "Yesterday",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Ingested 12 property listings",
        time: "3 days ago",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Archived 2023 records",
        time: "1 week ago",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Synced Google Drive documents",
        time: "1 week ago",
        status: "Completed",
      },
    ],
  },
  {
    id: "ops",
    name: "Ops",
    role: "Automation Runner",
    status: "special",
    currentTask: "Running scheduled reports",
    lastActive: "5 min ago",
    scenePosition: DeskPositions[4],
    spriteImage: "/sprites/sprite-ops.png",
    avatarColour: "bg-rose-500",
    stats: { totalTasks: 84, todayTasks: 4, avgDuration: "3m 10s" },
    recentJobs: [
      {
        type: "Task",
        description: "Weekly leads report generated",
        time: "Today, 17:00",
        status: "In Progress",
      },
      {
        type: "Task",
        description: "Daily email digest sent",
        time: "Today, 08:00",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Nightly backup completed",
        time: "Yesterday, 02:00",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Monthly analytics report",
        time: "1 week ago",
        status: "Completed",
      },
      {
        type: "Task",
        description: "Lead qualification batch run",
        time: "1 week ago",
        status: "Completed",
      },
    ],
  },
];

interface OfficeProps {
  readonly onQuickChat?: () => void;
}

type ViewMode = "desk" | "list";

export function Office({ onQuickChat }: OfficeProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("desk");
  const [activeAgent, setActiveAgent] = React.useState<string | undefined>(
    undefined,
  );
  const [sceneHeightPx, setSceneHeightPx] = React.useState(0);
  const sceneRef = React.useRef<HTMLDivElement>(null);
  const accordionRef = React.useRef<HTMLDivElement>(null);

  // Sprite height scales with the scene container (background) size
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
    if (mode === "list" && !activeAgent) {
      setActiveAgent(agents[0].id);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 p-6">
      <Tabs
        value={viewMode}
        onValueChange={handleTabChange}
        className="flex flex-col flex-1 min-h-0 w-full"
      >
        <TabsList variant="line" className="mb-5 w-fit shrink-0">
          <TabsTrigger
            value="desk"
            className={
              viewMode === "desk"
                ? "font-semibold text-accent border-b-2 border-accent rounded-none pb-1.5 -mb-px"
                : "text-muted hover:text-text transition-colors duration-200"
            }
          >
            Desk view
          </TabsTrigger>
          <TabsTrigger
            value="list"
            className={
              viewMode === "list"
                ? "font-semibold text-accent border-b-2 border-accent rounded-none pb-1.5 -mb-px"
                : "text-muted hover:text-text transition-colors duration-200"
            }
          >
            List view
          </TabsTrigger>
        </TabsList>

        <TabsContent value="desk" className="mt-0 flex-1 min-h-0 flex flex-col">
          <div
            ref={sceneRef}
            className="relative w-full flex-1 min-h-0 overflow-hidden rounded-xl border border-border-subtle bg-transparent"
          >
            <img
              src="/pixel-office-bg.png"
              alt="AI Office"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ imageRendering: "pixelated" }}
              draggable={false}
            />
            {agents.map((agent) => {
              const isActive = activeAgent === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  className="absolute cursor-pointer group z-10 bg-transparent border-0 p-0 focus:outline-none flex flex-col items-center"
                  style={{
                    top: agent.scenePosition.top,
                    left: agent.scenePosition.left,
                    transform: "translate(-50%, -100%)",
                  }}
                  onClick={() => handleAgentClick(agent.id)}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-surface-raised/95 backdrop-blur-sm text-text text-xs p-3 rounded-xl shadow-xl z-20 min-w-44 border border-border pointer-events-none">
                    <div className="font-semibold">{agent.name}</div>
                    <div className="text-muted mb-1 text-[10px]">
                      {agent.role}
                    </div>
                    <div className="text-text/90">{agent.currentTask}</div>
                    <div className="text-muted/60 mt-1 text-[10px]">
                      Last active: {agent.lastActive}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-1 bg-surface/85 backdrop-blur-sm px-2 py-0.5 rounded-full border border-border-subtle">
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
                    <span className="text-text text-[10px] whitespace-nowrap leading-tight">
                      {agent.name}
                    </span>
                  </div>
                  <img
                    src={agent.spriteImage}
                    alt={agent.name}
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
            <button
              className="absolute bottom-4 right-4 z-10 bg-surface/80 backdrop-blur-sm hover:bg-surface-elevated text-text text-sm px-4 py-2 rounded-full shadow-lg border border-border-subtle transition-all duration-200 cursor-pointer hover:border-accent/30"
              onClick={onQuickChat}
            >
              Quick Chat
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
                  key={agent.id}
                  value={agent.id}
                  id={`agent-${agent.id}`}
                >
                  <AccordionTrigger className="hover:no-underline px-2">
                    <div className="flex items-center gap-3 flex-1">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${agent.avatarColour}`}
                      >
                        {agent.name[0]}
                      </div>
                      <div className="flex-1 text-left">
                        <span className="font-semibold text-sm tracking-tight">
                          {agent.name}
                        </span>
                        <span className="text-muted text-sm ml-2">
                          {agent.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mr-2">
                        <div
                          className={`w-2 h-2 rounded-full ${statusColours[agent.status]}`}
                        />
                        <span className="text-xs text-muted capitalize">
                          {agent.status}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-2">
                    <div className="flex gap-3 mb-5 flex-wrap">
                      <div className="bg-surface-elevated rounded-xl px-5 py-3 text-center min-w-20 border border-border-subtle">
                        <div className="text-lg font-bold text-text">
                          {agent.stats.totalTasks}
                        </div>
                        <div className="text-xs text-muted">Total tasks</div>
                      </div>
                      <div className="bg-surface-elevated rounded-xl px-5 py-3 text-center min-w-20 border border-border-subtle">
                        <div className="text-lg font-bold text-text">
                          {agent.stats.todayTasks}
                        </div>
                        <div className="text-xs text-muted">Today</div>
                      </div>
                      <div className="bg-surface-elevated rounded-xl px-5 py-3 text-center min-w-20 border border-border-subtle">
                        <div className="text-sm font-semibold text-text">
                          {agent.stats.avgDuration}
                        </div>
                        <div className="text-xs text-muted">Avg duration</div>
                      </div>
                    </div>
                    <div className="space-y-0">
                      {agent.recentJobs.map((job, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0"
                        >
                          <Badge
                            variant="outline"
                            className="text-xs shrink-0 border-border-subtle"
                          >
                            {job.type}
                          </Badge>
                          <span className="text-sm flex-1 min-w-0 truncate text-text/90">
                            {job.description}
                          </span>
                          <span className="text-xs text-muted shrink-0 hidden sm:block">
                            {job.time}
                          </span>
                          <Badge
                            className={`text-xs shrink-0 border-0 ${jobStatusColours[job.status]}`}
                          >
                            {job.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
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
