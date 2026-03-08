import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IconSend, IconSearch, IconCheck, IconChevronRight } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";

// ============================================================================
// CHAT TAB
// ============================================================================

interface Message {
  id: string;
  sender: "user" | "axel";
  content: string;
  timestamp: Date;
}

// Onboarding state and types
type OnboardingStep = "welcome" | "name" | "role" | "helpWith" | "channels" | "complete";

interface OnboardingState {
  step: OnboardingStep;
  name: string;
  role: string;
  helpWith: string[];
  channels: string[];
}

const HELP_OPTIONS = [
  { id: "email", label: "Email management" },
  { id: "documents", label: "Document management" },
  { id: "scheduling", label: "Scheduling & calendar" },
  { id: "research", label: "Research & analysis" },
  { id: "social", label: "Social media" },
];

const CHANNEL_OPTIONS = [
  { id: "email", label: "Email" },
  { id: "slack", label: "Slack" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "teams", label: "Microsoft Teams" },
];

// Fixed initial timestamp for the welcome message
const INITIAL_TIMESTAMP = new Date(Date.now() - 3600000);

export function Chat() {
  const { onboardingCompleted, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  
  // Onboarding state
  const [onboarding, setOnboarding] = useState<OnboardingState>({
    step: "welcome",
    name: "",
    role: "",
    helpWith: [],
    channels: [],
  });
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "axel",
      content: "Hi! I'm Axel, your AI employee. How can I help you today?",
      timestamp: INITIAL_TIMESTAMP,
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      setMessages([
        ...messages,
        {
          id: Date.now().toString(),
          sender: "user",
          content: input,
          timestamp: new Date(),
        },
      ]);
      setInput("");

      // Simulate Axel response
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: "axel",
            content: "I'm processing your request...",
            timestamp: new Date(),
          },
        ]);
      }, 1000);
    }
  };

  // Onboarding handlers
  const startOnboarding = () => {
    setOnboarding((prev) => ({ ...prev, step: "name" }));
  };

  const handleOnboardingComplete = async () => {
    setIsCompleting(true);
    const result = await completeOnboarding();
    if (result.success) {
      setOnboarding((prev) => ({ ...prev, step: "complete" }));
    }
    setIsCompleting(false);
  };

  const toggleHelpOption = (id: string) => {
    setOnboarding((prev) => ({
      ...prev,
      helpWith: prev.helpWith.includes(id)
        ? prev.helpWith.filter((h) => h !== id)
        : [...prev.helpWith, id],
    }));
  };

  const toggleChannelOption = (id: string) => {
    setOnboarding((prev) => ({
      ...prev,
      channels: prev.channels.includes(id)
        ? prev.channels.filter((c) => c !== id)
        : [...prev.channels, id],
    }));
  };

  const canProceed = () => {
    switch (onboarding.step) {
      case "name":
        return onboarding.name.trim().length > 0;
      case "role":
        return onboarding.role.trim().length > 0;
      case "helpWith":
        return onboarding.helpWith.length > 0;
      case "channels":
        return onboarding.channels.length > 0;
      default:
        return true;
    }
  };

  const nextStep = () => {
    const steps: OnboardingStep[] = ["welcome", "name", "role", "helpWith", "channels"];
    const currentIndex = steps.indexOf(onboarding.step);
    if (currentIndex < steps.length - 1) {
      setOnboarding((prev) => ({ ...prev, step: steps[currentIndex + 1] }));
    } else {
      handleOnboardingComplete();
    }
  };

  // Render onboarding UI if not completed
  if (!onboardingCompleted && onboarding.step !== "complete") {
    return (
      <div className="h-full flex flex-col p-6 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full space-y-6">
          {/* Welcome Step */}
          {onboarding.step === "welcome" && (
            <Card className="border border-border">
              <CardHeader className="text-center">
                <div className="text-4xl mb-4">👋</div>
                <CardTitle className="text-2xl text-text">Welcome to Axel</CardTitle>
                <p className="text-muted mt-2">
                  I'm your AI employee, ready to help you be more productive.
                  Let me ask a few quick questions to get set up.
                </p>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button
                  onClick={startOnboarding}
                  className="bg-accent hover:bg-accent/90 text-white"
                >
                  Let's get started <IconChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Name Step */}
          {onboarding.step === "name" && (
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-text">What should I call you?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboardingName" className="text-text">Your name</Label>
                  <Input
                    id="onboardingName"
                    value={onboarding.name}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                    className="bg-surface-raised border-border text-text"
                    autoFocus
                  />
                </div>
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Role Step */}
          {onboarding.step === "role" && (
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-text">What do you do, {onboarding.name}?</CardTitle>
                <p className="text-muted text-sm">What's your role or title?</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="onboardingRole" className="text-text">Your role</Label>
                  <Input
                    id="onboardingRole"
                    value={onboarding.role}
                    onChange={(e) => setOnboarding((prev) => ({ ...prev, role: e.target.value }))}
                    placeholder="e.g., Marketing Manager, Founder, etc."
                    className="bg-surface-raised border-border text-text"
                    autoFocus
                  />
                </div>
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Help With Step */}
          {onboarding.step === "helpWith" && (
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-text">What should I help you with?</CardTitle>
                <p className="text-muted text-sm">Select all that apply</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {HELP_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleHelpOption(option.id)}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        onboarding.helpWith.includes(option.id)
                          ? "border-accent bg-surface-elevated"
                          : "border-border hover:border-border/60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-text font-medium">{option.label}</span>
                        {onboarding.helpWith.includes(option.id) && (
                          <IconCheck className="w-5 h-5 text-accent" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={nextStep}
                  disabled={!canProceed()}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                >
                  Continue
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Channels Step */}
          {onboarding.step === "channels" && (
            <Card className="border border-border">
              <CardHeader>
                <CardTitle className="text-text">Where should I communicate?</CardTitle>
                <p className="text-muted text-sm">Select your preferred channels</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {CHANNEL_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleChannelOption(option.id)}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${
                        onboarding.channels.includes(option.id)
                          ? "border-accent bg-surface-elevated"
                          : "border-border hover:border-border/60"
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-text font-medium">{option.label}</span>
                        {onboarding.channels.includes(option.id) && (
                          <IconCheck className="w-4 h-4 text-accent" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <Button
                  onClick={nextStep}
                  disabled={!canProceed() || isCompleting}
                  className="w-full bg-accent hover:bg-accent/90 text-white"
                >
                  {isCompleting ? "Setting up..." : "Complete Setup"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Show completion message after onboarding
  if (!onboardingCompleted && onboarding.step === "complete") {
    return (
      <div className="h-full flex flex-col p-6 overflow-y-auto">
        <div className="max-w-lg mx-auto w-full">
          <Card className="border border-border">
            <CardHeader className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <CardTitle className="text-2xl text-text">You're all set, {onboarding.name}!</CardTitle>
              <p className="text-muted mt-2">
                I'm ready to help you with {onboarding.helpWith.length} areas and can reach you via {onboarding.channels.join(", ")}.
              </p>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button
                onClick={() => navigate("/dashboard/office")}
                className="bg-accent hover:bg-accent/90 text-white"
              >
                Enter Dashboard <IconChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Normal chat view (after onboarding)
  return (
    <div className="h-full flex flex-col p-6">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.sender === "user"
                  ? "bg-accent text-white rounded-br-none"
                  : "bg-surface-raised text-text rounded-bl-none"
              }`}
            >
              <p className="text-sm">{msg.content}</p>
              <p className="text-xs mt-1 opacity-70">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          placeholder="Tell Axel what to do..."
          className="bg-surface-raised border-border text-text"
        />
        <Button
          onClick={handleSend}
          className="bg-accent hover:bg-accent/90 text-white px-4"
        >
          <IconSend className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

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
    <div className="p-6 space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <IconSearch className="absolute left-3 top-3 w-4 h-4 text-muted" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search tasks..."
            className="pl-10 bg-surface-raised border-border text-text"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-surface-raised border-border text-text">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent className="bg-surface-raised border-border">
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tasks Table */}
      <Card className="border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted">Task</TableHead>
              <TableHead className="text-muted">Agent</TableHead>
              <TableHead className="text-muted">Status</TableHead>
              <TableHead className="text-muted">Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((task) => (
              <TableRow
                key={task.id}
                className="border-border hover:bg-surface-raised/50"
              >
                <TableCell className="text-text font-medium">
                  {task.name}
                </TableCell>
                <TableCell className="text-muted">{task.agent}</TableCell>
                <TableCell>
                  <Badge
                    className={`${statusColors[task.status as keyof typeof statusColors]} border-0`}
                  >
                    {statusLabels[task.status as keyof typeof statusLabels]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted">{task.dueDate}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ============================================================================
// CRONS TAB
// ============================================================================

export function Crons() {
  return (
    <div className="p-6">
      <Card className="border border-border">
        <CardHeader>
          <CardTitle className="text-text">Automated Schedules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
            <div>
              <p className="text-text font-medium">Daily email digest</p>
              <p className="text-sm text-muted">Every day at 9:00 AM</p>
            </div>
            <Badge className="bg-success/20 text-success border-0">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
            <div>
              <p className="text-text font-medium">Weekly report generation</p>
              <p className="text-sm text-muted">Every Monday at 2:00 PM</p>
            </div>
            <Badge className="bg-success/20 text-success border-0">
              Active
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
            <div>
              <p className="text-text font-medium">Document indexing</p>
              <p className="text-sm text-muted">Every 6 hours</p>
            </div>
            <Badge className="bg-success/20 text-success border-0">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// INTEGRATIONS TAB
// ============================================================================

export function Integrations() {
  const integrations = [
    { name: "Gmail", status: "connected", icon: "📧" },
    { name: "Slack", status: "connected", icon: "💬" },
    { name: "Google Calendar", status: "connected", icon: "📅" },
    { name: "Notion", status: "not-connected", icon: "📝" },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <Card key={integration.name} className="border border-border">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <p className="text-text font-medium">{integration.name}</p>
                    <p className="text-xs text-muted">
                      {integration.status === "connected"
                        ? "Connected"
                        : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="border-border text-text text-xs"
                >
                  {integration.status === "connected" ? "Manage" : "Connect"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SETTINGS TAB
// ============================================================================

export function Settings() {
  const [email, setEmail] = useState("user@example.com");
  const [name, setName] = useState("John Doe");
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="p-6 max-w-2xl">
      <div className="space-y-8">
        {/* Profile Section */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-text">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-text">
                Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-surface-raised border-border text-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-text">
                Email
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-surface-raised border-border text-text"
              />
            </div>
            <Button className="bg-accent hover:bg-accent/90 text-white">
              Save changes
            </Button>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-text">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-text font-medium">Email notifications</p>
                <p className="text-sm text-muted">
                  Get notified of important updates
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setNotifications(!notifications)}
                className={`border-border ${
                  notifications
                    ? "bg-success/20 text-success"
                    : "bg-muted/20 text-muted"
                }`}
              >
                {notifications ? "On" : "Off"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing Section */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-text">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-raised rounded border border-border">
              <div>
                <p className="text-text font-medium">Current plan</p>
                <p className="text-sm text-muted">Professional - £79/month</p>
              </div>
              <Button
                variant="outline"
                className="border-border text-text text-xs"
              >
                Change plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
