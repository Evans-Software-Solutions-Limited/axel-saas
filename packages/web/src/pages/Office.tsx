import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  idle: "bg-green-500",
  busy: "bg-yellow-500",
  working: "bg-red-500",
  special: "bg-purple-500",
};

const statusGlow: Record<AgentStatus, string> = {
  idle: "",
  busy: "drop-shadow(0 0 6px rgba(234,179,8,0.9))",
  working: "drop-shadow(0 0 6px rgba(239,68,68,0.9))",
  special: "drop-shadow(0 0 6px rgba(168,85,247,0.9))",
};

/** Height (px) at which sprite images are rendered in the scene. */
const SPRITE_HEIGHT = 80;

const jobStatusColours: Record<RecentJob["status"], string> = {
  Completed: "bg-green-500/20 text-green-400",
  "In Progress": "bg-yellow-500/20 text-yellow-400",
  Failed: "bg-red-500/20 text-red-400",
};

const DeskPositions = [
  {
    top: "36%",
    left: "16.75%",
  },
  {
    top: "36%",
    left: "38%",
  },
  {
    top: "36%",
    left: "57.5%",
  },
  {
    top: "36%",
    left: "79.5%",
  },
  {
    top: "90%",
    left: "22%",
  },
  {
    top: "90%",
    left: "58%",
  },
  {
    top: "90%",
    left: "89%",
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
    avatarColour: "bg-blue-600",
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
    // Top row, 4th cubicle from left
    scenePosition: DeskPositions[1],
    spriteImage: "/sprites/sprite-scribe.png",
    avatarColour: "bg-emerald-600",
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
    // Bottom row, left L-desk
    scenePosition: DeskPositions[2],
    spriteImage: "/sprites/sprite-relay.png",
    avatarColour: "bg-violet-600",
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
    // Bottom row, center L-desk
    scenePosition: DeskPositions[3],
    spriteImage: "/sprites/sprite-keeper.png",
    avatarColour: "bg-amber-600",
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
    // Bottom row, right L-desk
    scenePosition: DeskPositions[4],
    spriteImage: "/sprites/sprite-ops.png",
    avatarColour: "bg-rose-600",
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

export function Office({ onQuickChat }: OfficeProps) {
  const [activeAgent, setActiveAgent] = React.useState<string | undefined>(
    undefined,
  );
  const accordionRef = React.useRef<HTMLDivElement>(null);

  function handleAgentClick(agentId: string) {
    setActiveAgent(agentId);
    setTimeout(() => {
      accordionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  return (
    <div className="p-6 space-y-6">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-white/5 bg-[#6bb8d4]"
        style={{ aspectRatio: "16/9" }}
      >
        {/* Pixel office background — generated clean scene, no baked-in characters */}
        <img
          src="/pixel-office-bg.png"
          alt="AI Office"
          className="absolute inset-0 w-full h-full object-contain"
          style={{ imageRendering: "pixelated" }}
          draggable={false}
        />

        {/* Per-agent sprite + status overlay */}
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
              {/* Hover tooltip — floats above everything */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black/90 text-white text-xs p-3 rounded-lg shadow-xl z-20 min-w-44 border border-white/10 pointer-events-none">
                <div className="font-semibold">{agent.name}</div>
                <div className="text-white/60 mb-1 text-[10px]">
                  {agent.role}
                </div>
                <div className="text-white/90">{agent.currentTask}</div>
                <div className="text-white/40 mt-1 text-[10px]">
                  Last active: {agent.lastActive}
                </div>
              </div>

              {/* Name + status badge */}
              <div className="flex items-center gap-1.5 mb-1 bg-black/75 px-2 py-0.5 rounded-full border border-white/10">
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
                  {agent.name}
                </span>
              </div>

              {/* Individual character sprite */}
              <img
                src={agent.spriteImage}
                alt={agent.name}
                style={{
                  height: SPRITE_HEIGHT,
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
          className="absolute bottom-4 right-4 z-10 bg-black/70 hover:bg-black/90 text-white text-sm px-4 py-2 rounded-full shadow-lg border border-white/10 transition-colors cursor-pointer"
          onClick={onQuickChat}
        >
          💬 Quick Chat
        </button>
      </div>

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
                    <span className="font-semibold text-sm">{agent.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {agent.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mr-2">
                    <div
                      className={`w-2 h-2 rounded-full ${statusColours[agent.status]}`}
                    />
                    <span className="text-xs text-muted-foreground capitalize">
                      {agent.status}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2">
                <div className="flex gap-3 mb-4 flex-wrap">
                  <div className="bg-card rounded-lg px-4 py-2 text-center min-w-20">
                    <div className="text-lg font-bold">
                      {agent.stats.totalTasks}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total tasks
                    </div>
                  </div>
                  <div className="bg-card rounded-lg px-4 py-2 text-center min-w-20">
                    <div className="text-lg font-bold">
                      {agent.stats.todayTasks}
                    </div>
                    <div className="text-xs text-muted-foreground">Today</div>
                  </div>
                  <div className="bg-card rounded-lg px-4 py-2 text-center min-w-20">
                    <div className="text-sm font-semibold">
                      {agent.stats.avgDuration}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avg duration
                    </div>
                  </div>
                </div>
                <div className="space-y-0">
                  {agent.recentJobs.map((job, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
                    >
                      <Badge variant="outline" className="text-xs shrink-0">
                        {job.type}
                      </Badge>
                      <span className="text-sm flex-1 min-w-0 truncate">
                        {job.description}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
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
    </div>
  );
}
