import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IconCircleCheckFilled,
  IconClock,
  IconFile,
  IconMail,
  IconBolt,
} from "@tabler/icons-react";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
}

interface AgentCard {
  name: string;
  role: string;
  status: "online" | "busy" | "idle";
  avatar: string;
  currentTask?: string;
}

const stats: StatCard[] = [
  {
    label: "Tasks completed today",
    value: "12",
    icon: <IconCircleCheckFilled className="w-6 h-6 text-success" />,
    trend: "+2 from yesterday",
  },
  {
    label: "Active automations",
    value: "8",
    icon: <IconBolt className="w-6 h-6 text-accent" />,
  },
  {
    label: "Documents indexed",
    value: "47",
    icon: <IconFile className="w-6 h-6 text-warning" />,
  },
  {
    label: "Messages handled",
    value: "143",
    icon: <IconMail className="w-6 h-6 text-muted" />,
  },
];

const agents: AgentCard[] = [
  {
    name: "Axel",
    role: "Chief Task Handler",
    status: "online",
    avatar: "A",
    currentTask: "Processing email inbox",
  },
  {
    name: "Automata",
    role: "Workflow Engineer",
    status: "online",
    avatar: "AU",
    currentTask: "Running scheduled reports",
  },
  {
    name: "Keeper",
    role: "Knowledge Manager",
    status: "busy",
    avatar: "K",
    currentTask: "Indexing new documents",
  },
];

function StatusBadge({ status }: { status: "online" | "busy" | "idle" }) {
  const colors = {
    online: { bg: "bg-success/20", text: "text-success" },
    busy: { bg: "bg-warning/20", text: "text-warning" },
    idle: { bg: "bg-muted/20", text: "text-muted" },
  };

  return (
    <Badge className={`${colors[status].bg} ${colors[status].text} border-0`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function Office() {
  return (
    <div className="p-6 space-y-8">
      {/* Stats Section */}
      <div>
        <h2 className="text-2xl font-bold text-text mb-4">Today's summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="border border-border bg-surface-raised">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted mb-2">{stat.label}</p>
                    <p className="text-3xl font-bold text-text">{stat.value}</p>
                    {stat.trend && (
                      <p className="text-xs text-success mt-2">{stat.trend}</p>
                    )}
                  </div>
                  <div>{stat.icon}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Team Section */}
      <div>
        <h2 className="text-2xl font-bold text-text mb-4">Your AI team</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent, idx) => (
            <Card key={idx} className="border border-border bg-surface-raised">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">
                      {agent.avatar}
                    </div>
                    <div>
                      <CardTitle className="text-base text-text">
                        {agent.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {agent.role}
                      </CardDescription>
                    </div>
                  </div>
                  <StatusBadge status={agent.status} />
                </div>
              </CardHeader>
              <CardContent>
                {agent.currentTask && (
                  <div className="flex items-start gap-2">
                    <IconClock className="w-4 h-4 text-muted mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-muted">{agent.currentTask}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl font-bold text-text mb-4">Recent activity</h2>
        <Card className="border border-border">
          <CardContent className="pt-6">
            <div className="space-y-3">
              {[
                {
                  time: "2 hours ago",
                  action: "Processed 23 emails",
                  agent: "Axel",
                },
                {
                  time: "4 hours ago",
                  action: "Indexed 5 new documents",
                  agent: "Keeper",
                },
                {
                  time: "6 hours ago",
                  action: "Generated daily report",
                  agent: "Automata",
                },
              ].map((activity, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="text-text font-medium">{activity.action}</p>
                    <p className="text-xs text-muted">{activity.time}</p>
                  </div>
                  <Badge variant="outline" className="border-border text-muted">
                    {activity.agent}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Office;
