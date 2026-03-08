import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TaskType =
  | "email"
  | "documents"
  | "scheduling"
  | "compliance"
  | "research"
  | "social-media";
type ChannelType = "email" | "slack" | "whatsapp" | "teams";

interface OnboardingResponse {
  role: "assistant" | "user";
  content: string;
}

interface OnboardingData {
  name: string;
  businessName: string;
  businessDescription: string;
  tasks: TaskType[];
  channels: ChannelType[];
}

const TASK_OPTIONS: { id: TaskType; label: string; description: string }[] = [
  {
    id: "email",
    label: "Email management",
    description: "Handle email inbox and drafts",
  },
  {
    id: "documents",
    label: "Document management",
    description: "Organize and summarize documents",
  },
  {
    id: "scheduling",
    label: "Scheduling",
    description: "Manage calendar and meetings",
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Monitor compliance requirements",
  },
  {
    id: "research",
    label: "Research",
    description: "Gather and analyze information",
  },
  {
    id: "social-media",
    label: "Social media",
    description: "Manage social platforms",
  },
];

const CHANNEL_OPTIONS: { id: ChannelType; label: string }[] = [
  { id: "email", label: "Email" },
  { id: "slack", label: "Slack" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "teams", label: "Microsoft Teams" },
];

type OnboardingPhase =
  | "intro"
  | "name"
  | "businessName"
  | "businessDescription"
  | "tasks"
  | "channels"
  | "complete";

const PHASE_PROMPTS: Record<OnboardingPhase, string> = {
  intro:
    "Hi there! I'm Axel, your new AI employee. I'd love to get to know you and understand how I can help. Shall we start?",
  name: "Great! First, what should I call you?",
  businessName: `Nice to meet you, {{name }}! So, what does your business do — or what's the name you'd like me to use?`,
  businessDescription: `Got it — {{businessName }}. Tell me a bit about what your business does. What's the core focus or service?`,
  tasks: `Interesting! Now, what are the main tasks you'd like me to handle day-to-day?`,
  channels: `Perfect. Last question — which communication channels should I monitor and respond to?`,
  complete: `That's all I need for now! Let me summarize what we've discussed...`,
};

export function Onboarding() {
  const [phase, setPhase] = useState<OnboardingPhase>("intro");
  const [messages, setMessages] = useState<OnboardingResponse[]>([]);
  const [data, setData] = useState<OnboardingData>({
    name: "",
    businessName: "",
    businessDescription: "",
    tasks: [],
    channels: [],
  });
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (role: OnboardingResponse["role"], content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
  };

  const getPrompt = (phase: OnboardingPhase): string => {
    let prompt = PHASE_PROMPTS[phase];
    prompt = prompt.replace("{{name}}", data.name);
    prompt = prompt.replace("{{businessName}}", data.businessName);
    return prompt;
  };

  const startOnboarding = () => {
    addMessage("assistant", getPrompt("name"));
    setPhase("name");
  };

  const handleNameSubmit = () => {
    if (!inputValue.trim()) return;
    setData((prev) => ({ ...prev, name: inputValue.trim() }));
    addMessage("user", inputValue.trim());
    addMessage(
      "assistant",
      getPrompt("businessName").replace("{{name}}", inputValue.trim()),
    );
    setPhase("businessName");
    setInputValue("");
  };

  const handleBusinessNameSubmit = () => {
    if (!inputValue.trim()) return;
    setData((prev) => ({ ...prev, businessName: inputValue.trim() }));
    addMessage("user", inputValue.trim());
    addMessage(
      "assistant",
      getPrompt("businessDescription").replace(
        "{{businessName}}",
        inputValue.trim(),
      ),
    );
    setPhase("businessDescription");
    setInputValue("");
  };

  const handleBusinessDescriptionSubmit = () => {
    if (!inputValue.trim()) return;
    setData((prev) => ({ ...prev, businessDescription: inputValue.trim() }));
    addMessage("user", inputValue.trim());
    addMessage("assistant", getPrompt("tasks"));
    setPhase("tasks");
  };

  const toggleTask = (task: TaskType) => {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.includes(task)
        ? prev.tasks.filter((t) => t !== task)
        : [...prev.tasks, task],
    }));
  };

  const handleTasksSubmit = () => {
    if (data.tasks.length === 0) return;
    const taskLabels = data.tasks
      .map((t) => TASK_OPTIONS.find((opt) => opt.id === t)?.label)
      .filter(Boolean)
      .join(", ");
    addMessage("user", taskLabels);
    addMessage("assistant", getPrompt("channels"));
    setPhase("channels");
  };

  const toggleChannel = (channel: ChannelType) => {
    setData((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  const handleChannelsSubmit = () => {
    if (data.channels.length === 0) return;
    const channelLabels = data.channels
      .map((c) => CHANNEL_OPTIONS.find((opt) => opt.id === c)?.label)
      .filter(Boolean)
      .join(", ");
    const taskLabels = data.tasks
      .map((t) => TASK_OPTIONS.find((opt) => opt.id === t)?.label)
      .filter(Boolean)
      .join(", ");
    addMessage("user", channelLabels);
    setPhase("complete");
    // Show summary
    const summary = `Here's what I've learned:\n\n**You:** ${data.name}\n**Business:** ${data.businessName}\n**What you do:** ${data.businessDescription}\n**Tasks:** ${taskLabels}\n**Channels:** ${channelLabels}`;
    addMessage("assistant", summary);
  };

  const handleComplete = () => {
    // TODO: Save onboarding data to backend when API is ready
    navigate("/dashboard");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (phase === "name") handleNameSubmit();
      else if (phase === "businessName") handleBusinessNameSubmit();
      else if (phase === "businessDescription")
        handleBusinessDescriptionSubmit();
    }
  };

  // Render intro phase
  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border border-border">
            <CardContent className="pt-8 pb-8">
              <div className="text-center space-y-4">
                <div className="text-5xl mb-4">👋</div>
                <h1 className="text-2xl font-bold text-text">
                  Welcome to Axel
                </h1>
                <p className="text-muted max-w-md mx-auto">
                  I'm your AI employee, designed to help you with emails,
                  scheduling, documents, and more. Let's get acquainted so I can
                  start being useful.
                </p>
                <Button
                  onClick={startOnboarding}
                  className="bg-accent hover:bg-accent/90 text-white mt-4"
                >
                  Let's get started
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render task selection phase
  if (phase === "tasks") {
    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border border-border">
            <CardContent className="pt-6 pb-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    A
                  </div>
                  <div className="text-text">{getPrompt("tasks")}</div>
                </div>

                <div className="space-y-3 pl-11">
                  {TASK_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleTask(option.id)}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                        data.tasks.includes(option.id)
                          ? "border-accent bg-surface-elevated"
                          : "border-border hover:border-border/60"
                      }`}
                    >
                      <div className="font-semibold text-text">
                        {option.label}
                      </div>
                      <div className="text-sm text-muted">
                        {option.description}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end pl-11 pt-2">
                  <Button
                    onClick={handleTasksSubmit}
                    disabled={data.tasks.length === 0}
                    className="bg-accent hover:bg-accent/90 text-white"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render channel selection phase
  if (phase === "channels") {
    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border border-border">
            <CardContent className="pt-6 pb-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm shrink-0">
                    A
                  </div>
                  <div className="text-text">{getPrompt("channels")}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 pl-11">
                  {CHANNEL_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => toggleChannel(option.id)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        data.channels.includes(option.id)
                          ? "border-accent bg-surface-elevated"
                          : "border-border hover:border-border/60"
                      }`}
                    >
                      <div className="font-semibold text-text text-center">
                        {option.label}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end pl-11 pt-2">
                  <Button
                    onClick={handleChannelsSubmit}
                    disabled={data.channels.length === 0}
                    className="bg-accent hover:bg-accent/90 text-white"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render complete phase
  if (phase === "complete") {
    const taskLabels = data.tasks
      .map((t) => TASK_OPTIONS.find((opt) => opt.id === t)?.label)
      .filter(Boolean);
    const channelLabels = data.channels
      .map((c) => CHANNEL_OPTIONS.find((opt) => opt.id === c)?.label)
      .filter(Boolean);

    return (
      <div className="min-h-screen bg-surface p-6">
        <div className="max-w-2xl mx-auto">
          <Card className="border border-border">
            <CardContent className="pt-6 pb-6">
              <div className="text-center space-y-4 mb-6">
                <div className="text-5xl">🎉</div>
                <h2 className="text-xl font-bold text-text">
                  All done, {data.name}!
                </h2>
                <p className="text-muted">
                  Here's what we'll work on together:
                </p>
              </div>

              <div className="bg-surface-elevated rounded-lg p-4 border border-border space-y-4 mb-6">
                <div>
                  <p className="text-xs text-muted uppercase font-semibold mb-2">
                    About you
                  </p>
                  <p className="text-text">
                    {data.name} — {data.businessName}
                  </p>
                  <p className="text-sm text-muted mt-1">
                    {data.businessDescription}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted uppercase font-semibold mb-2">
                    Tasks I'll handle
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {taskLabels.map((label) => (
                      <Badge
                        key={label}
                        className="bg-surface text-text border border-border"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted uppercase font-semibold mb-2">
                    Channels
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {channelLabels.map((label) => (
                      <Badge
                        key={label}
                        className="bg-surface text-text border border-border"
                      >
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Button
                  onClick={handleComplete}
                  className="bg-accent hover:bg-accent/90 text-white"
                >
                  Enter dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Render conversational phases (name, businessName, businessDescription)
  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto">
        <Card className="border border-border">
          <CardContent className="pt-6 pb-6">
            {/* Messages */}
            <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 ${
                    msg.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white font-semibold text-sm shrink-0">
                      A
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-lg max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-accent text-white"
                        : "bg-surface-elevated text-text border border-border"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  phase === "name"
                    ? "Your name"
                    : phase === "businessName"
                      ? "Your business name"
                      : "Tell me about your business..."
                }
                className="bg-surface-raised border-border text-text"
                autoFocus
              />
              <Button
                onClick={
                  phase === "name"
                    ? handleNameSubmit
                    : phase === "businessName"
                      ? handleBusinessNameSubmit
                      : handleBusinessDescriptionSubmit
                }
                disabled={!inputValue.trim()}
                className="bg-accent hover:bg-accent/90 text-white"
              >
                Send
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Onboarding;
