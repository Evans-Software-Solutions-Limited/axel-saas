import { useState, useRef, useEffect } from "react";
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
import { IconSend, IconSearch } from "@tabler/icons-react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/eden";

// ============================================================================
// CHAT TAB
// ============================================================================

interface Message {
  id: string;
  sender: "user" | "axel";
  content: string;
  timestamp: Date;
}

// Onboarding question structure
interface OnboardingQuestion {
  id: string;
  question: string;
  key: keyof OnboardingAnswers;
  placeholder?: string;
  options?: { value: string; label: string }[];
  multiSelect?: boolean;
}

interface OnboardingAnswers {
  name: string;
  role: string;
  helpWith: string[];
  typicalDay: string;
  channels: string[];
  morningBrief: boolean;
  briefTime: string;
}

const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "name",
    question: "Hi! I'm Axel, your AI employee. To get started, what's your name?",
    key: "name",
    placeholder: "Your name",
  },
  {
    id: "role",
    question: "Great! And what is your role or title?",
    key: "role",
    placeholder: "e.g. Founder, Manager, etc.",
  },
  {
    id: "helpWith",
    question: "What would you like me to help you with?",
    key: "helpWith",
    options: [
      { value: "email", label: "Email management" },
      { value: "scheduling", label: "Scheduling & calendar" },
      { value: "tasks", label: "Task management" },
      { value: "research", label: "Research & information" },
      { value: "documents", label: "Document handling" },
      { value: "communication", label: "Team communication" },
    ],
    multiSelect: true,
  },
  {
    id: "typicalDay",
    question: "Can you describe a typical day or week for me? What are your priorities?",
    key: "typicalDay",
    placeholder: "Tell me about your typical week...",
  },
  {
    id: "channels",
    question: "Which channels should I monitor for your communications?",
    key: "channels",
    options: [
      { value: "email", label: "Email" },
      { value: "slack", label: "Slack" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "teams", label: "Microsoft Teams" },
    ],
    multiSelect: true,
  },
  {
    id: "morningBrief",
    question: "Would you like me to send you a morning brief with your priorities for the day?",
    key: "morningBrief",
    options: [
      { value: "true", label: "Yes, please!" },
      { value: "false", label: "Not right now" },
    ],
  },
];

export function Chat() {
  const { onboardingCompleted, refreshOnboardingStatus } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Onboarding state
  const [isOnboarding, setIsOnboarding] = useState(!onboardingCompleted);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<OnboardingAnswers>({
    name: "",
    role: "",
    helpWith: [],
    typicalDay: "",
    channels: [],
    morningBrief: false,
    briefTime: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const currentQuestion = ONBOARDING_QUESTIONS[currentQuestionIndex];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat based on onboarding status
  
  useEffect(() => {
    if (!onboardingCompleted && messages.length === 0) {
      // Start onboarding
      setIsOnboarding(true);
      setMessages([
        {
          id: "welcome",
          sender: "axel",
          content: currentQuestion.question,
          timestamp: new Date(),
        },
      ]);
    } else if (onboardingCompleted && messages.length === 0) {
      // Normal chat for completed users
      setIsOnboarding(false);
      setMessages([
        {
          id: "welcome",
          sender: "axel",
          content: "Hi! I'm Axel, your AI employee. How can I help you today?",
          timestamp: new Date(),
        },
      ]);
    }
  }, [onboardingCompleted, currentQuestion, messages.length]);

  // Update onboarding state when prop changes
  useEffect(() => {
    setIsOnboarding(!onboardingCompleted);
  }, [onboardingCompleted, currentQuestion, messages.length]);

  const addMessage = (content: string, sender: "user" | "axel") => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        sender,
        content,
        timestamp: new Date(),
      },
    ]);
  };

  const handleOnboardingResponse = async () => {
    if (!input.trim() || isSubmitting) return;

    const userResponse = input.trim();
    addMessage(userResponse, "user");
    setInput("");

    // Process the answer
    const answerKey = currentQuestion.key;
    
    if (currentQuestion.multiSelect) {
      // For multi-select, toggle the selected option
      // User types the option or number
      const selectedOptions = [...(onboardingAnswers[answerKey] as string[])];
      
      // Handle comma-separated values or single values
      const responses = userResponse.split(/[,;]/).map(s => s.trim().toLowerCase());
      
      for (const resp of responses) {
        const option = currentQuestion.options?.find(
          o => o.label.toLowerCase().includes(resp) || o.value.toLowerCase() === resp
        );
        if (option) {
          if (selectedOptions.includes(option.value)) {
            selectedOptions.splice(selectedOptions.indexOf(option.value), 1);
          } else {
            selectedOptions.push(option.value);
          }
        }
      }
      
      setOnboardingAnswers((prev) => ({
        ...prev,
        [answerKey]: selectedOptions,
      }));
    } else if (answerKey === "morningBrief") {
      // Boolean handling
      const isYes = userResponse.toLowerCase().startsWith("y") || 
                    userResponse.toLowerCase().includes("yes") ||
                    userResponse.toLowerCase().includes("sure") ||
                    userResponse.toLowerCase().includes("please");
      setOnboardingAnswers((prev) => ({
        ...prev,
        morningBrief: isYes,
      }));
    } else {
      // Regular string answer
      setOnboardingAnswers((prev) => ({
        ...prev,
        [answerKey]: userResponse,
      }));
    }

    // Move to next question or complete
    if (currentQuestionIndex < ONBOARDING_QUESTIONS.length - 1) {
      // Show typing indicator then next question
      setTimeout(() => {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        addMessage(ONBOARDING_QUESTIONS[nextIndex].question, "axel");
      }, 800);
    } else {
      // Onboarding complete - submit to backend
      setIsSubmitting(true);
      setTimeout(() => {
        addMessage("Perfect! Let me save your answers and get set up for you...", "axel");
      }, 500);

      try {
        await api.core.users.onboarding.post({
          name: onboardingAnswers.name || userResponse,
          role: onboardingAnswers.role,
          helpWith: onboardingAnswers.helpWith,
          typicalDay: onboardingAnswers.typicalDay,
          channels: onboardingAnswers.channels,
          morningBrief: onboardingAnswers.morningBrief,
          briefTime: onboardingAnswers.briefTime,
        });

        await refreshOnboardingStatus();
        setIsComplete(true);
        
        setTimeout(() => {
          addMessage(
            "You're all set! I've saved your preferences. You can now access all features of the dashboard. Is there anything specific you'd like me to help you with?",
            "axel"
          );
        }, 1000);
      } catch (error) {
        console.error("Failed to complete onboarding:", error);
        setTimeout(() => {
          addMessage(
            "I had trouble saving your answers. You can continue chatting with me, and your preferences have been noted. Is there anything else you'd like to discuss?",
            "axel"
          );
        }, 1000);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleNormalChat = () => {
    if (input.trim()) {
      addMessage(input, "user");
      setInput("");

      // Simulate Axel response
      setTimeout(() => {
        addMessage("I'm processing your request...", "axel");
      }, 1000);
    }
  };

  const handleSend = () => {
    if (isOnboarding && !isComplete) {
      handleOnboardingResponse();
    } else {
      handleNormalChat();
    }
  };

  // Render options for current question if available
  const renderQuestionOptions = () => {
    if (!currentQuestion?.options || isComplete) return null;
    
    const optionsText = currentQuestion.options
      .map((opt, idx) => `${idx + 1}. ${opt.label}`)
      .join("\n");
    
    return (
      <div className="mt-2 text-sm text-muted">
        <pre className="font-sans whitespace-pre-wrap">{optionsText}</pre>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Onboarding header */}
      {isOnboarding && !isComplete && (
        <div className="mb-4 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg">
          <p className="text-sm text-accent">
            ⚡ Welcome! Complete this quick onboarding to unlock all features ({currentQuestionIndex + 1}/{ONBOARDING_QUESTIONS.length})
          </p>
        </div>
      )}
      
      {isComplete && (
        <div className="mb-4 px-4 py-2 bg-success/10 border border-success/20 rounded-lg">
          <p className="text-sm text-success">
            ✓ Onboarding complete! You now have full access to Axel.
          </p>
        </div>
      )}

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
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              {msg.sender === "axel" && currentQuestion?.options && !isComplete && (
                renderQuestionOptions()
              )}
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
          onKeyPress={(e) => e.key === "Enter" && !isSubmitting && handleSend()}
          placeholder={
            isOnboarding && !isComplete
              ? currentQuestion?.placeholder || "Type your answer..."
              : "Tell Axel what to do..."
          }
          disabled={isSubmitting}
          className="bg-surface-raised border-border text-text"
        />
        <Button
          onClick={handleSend}
          disabled={isSubmitting || (!input.trim() && !isComplete)}
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
