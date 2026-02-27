import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  IconChevronRight,
  IconUpload,
  IconCircleCheckFilled,
} from "@tabler/icons-react";

type TaskType =
  | "email"
  | "documents"
  | "scheduling"
  | "compliance"
  | "research"
  | "social-media";
type ChannelType = "email" | "slack" | "whatsapp" | "teams";

interface OnboardingState {
  step: number;
  name: string;
  businessName: string;
  businessDescription: string;
  tasks: TaskType[];
  channels: ChannelType[];
  documents: File[];
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

export function Onboarding() {
  const [state, setState] = useState<OnboardingState>({
    step: 1,
    name: "",
    businessName: "",
    businessDescription: "",
    tasks: [],
    channels: [],
    documents: [],
  });

  const navigate = useNavigate();

  const toggleTask = (task: TaskType) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.includes(task)
        ? prev.tasks.filter((t) => t !== task)
        : [...prev.tasks, task],
    }));
  };

  const toggleChannel = (channel: ChannelType) => {
    setState((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setState((prev) => ({
      ...prev,
      documents: [...prev.documents, ...files],
    }));
  };

  const handleNext = () => {
    if (state.step < 6) {
      setState((prev) => ({ ...prev, step: prev.step + 1 }));
    } else {
      // Complete onboarding
      navigate("/dashboard");
    }
  };

  const handleBack = () => {
    if (state.step > 1) {
      setState((prev) => ({ ...prev, step: prev.step - 1 }));
    }
  };

  const isStepValid = () => {
    switch (state.step) {
      case 1:
        return state.name.trim() && state.businessName.trim();
      case 2:
        return state.businessDescription.trim();
      case 3:
        return state.tasks.length > 0;
      case 4:
        return state.channels.length > 0;
      case 5:
        return true; // Documents are optional
      case 6:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-surface p-6">
      <div className="max-w-2xl mx-auto">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                    step < state.step
                      ? "bg-success text-white"
                      : step === state.step
                        ? "bg-accent text-white"
                        : "bg-surface-raised border border-border text-muted"
                  }`}
                >
                  {step < state.step ? "✓" : step}
                </div>
                {step < 6 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step < state.step ? "bg-success" : "bg-border"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-muted text-sm">Step {state.step} of 6</p>
        </div>

        {/* Step Content */}
        <Card className="border border-border">
          <CardHeader>
            {state.step === 1 && (
              <>
                <CardTitle className="text-text">Let's get started</CardTitle>
                <CardDescription>
                  First, tell us about you and your business
                </CardDescription>
              </>
            )}
            {state.step === 2 && (
              <>
                <CardTitle className="text-text">
                  What does your business do?
                </CardTitle>
                <CardDescription>
                  Give us a brief description of your business
                </CardDescription>
              </>
            )}
            {state.step === 3 && (
              <>
                <CardTitle className="text-text">
                  What should Axel handle?
                </CardTitle>
                <CardDescription>
                  Select the tasks you want your AI employee to manage
                </CardDescription>
              </>
            )}
            {state.step === 4 && (
              <>
                <CardTitle className="text-text">Where do you work?</CardTitle>
                <CardDescription>
                  Select the channels Axel should monitor
                </CardDescription>
              </>
            )}
            {state.step === 5 && (
              <>
                <CardTitle className="text-text">Share knowledge</CardTitle>
                <CardDescription>
                  Upload key documents so Axel knows your policies and style
                </CardDescription>
              </>
            )}
            {state.step === 6 && (
              <>
                <CardTitle className="text-text">
                  Meet your new employee
                </CardTitle>
                <CardDescription>
                  Your onboarding is complete. Ready to get started?
                </CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Name & Business */}
            {state.step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-text">
                    Your name
                  </Label>
                  <Input
                    id="name"
                    value={state.name}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="John Doe"
                    className="bg-surface-raised border-border text-text"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName" className="text-text">
                    Business name
                  </Label>
                  <Input
                    id="businessName"
                    value={state.businessName}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        businessName: e.target.value,
                      }))
                    }
                    placeholder="Your Company Inc."
                    className="bg-surface-raised border-border text-text"
                  />
                </div>
              </>
            )}

            {/* Step 2: Business Description */}
            {state.step === 2 && (
              <div className="space-y-2">
                <Label htmlFor="description" className="text-text">
                  Business description
                </Label>
                <Textarea
                  id="description"
                  value={state.businessDescription}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      businessDescription: e.target.value,
                    }))
                  }
                  placeholder="Tell us what your company does..."
                  className="bg-surface-raised border-border text-text min-h-32"
                />
              </div>
            )}

            {/* Step 3: Tasks */}
            {state.step === 3 && (
              <div className="space-y-3">
                {TASK_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleTask(option.id)}
                    className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                      state.tasks.includes(option.id)
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
            )}

            {/* Step 4: Channels */}
            {state.step === 4 && (
              <div className="grid grid-cols-2 gap-3">
                {CHANNEL_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => toggleChannel(option.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      state.channels.includes(option.id)
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
            )}

            {/* Step 5: Document Upload */}
            {state.step === 5 && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                  <IconUpload className="w-8 h-8 text-muted mx-auto mb-3" />
                  <label className="cursor-pointer">
                    <span className="text-accent font-semibold hover:underline">
                      Click to upload
                    </span>
                    <span className="text-muted"> or drag and drop</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt"
                    />
                  </label>
                  <p className="text-xs text-muted mt-2">
                    PDF, DOC, DOCX, or TXT (up to 10MB each)
                  </p>
                </div>

                {state.documents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-text">
                      Uploaded files:
                    </p>
                    {state.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-surface-raised rounded border border-border text-sm text-muted"
                      >
                        <IconCircleCheckFilled className="w-4 h-4 text-success" />
                        {doc.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Summary */}
            {state.step === 6 && (
              <div className="space-y-6 text-center">
                <div className="text-5xl">👋</div>
                <div>
                  <p className="text-text font-semibold mb-2">
                    Welcome {state.name}!
                  </p>
                  <p className="text-muted text-sm">
                    Your AI employee is ready to help with:
                  </p>
                </div>

                <div className="space-y-3 text-left">
                  <div>
                    <p className="text-xs text-muted uppercase font-semibold mb-2">
                      Tasks
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {state.tasks.map((task) => (
                        <Badge
                          key={task}
                          className="bg-surface-elevated text-text border border-border"
                        >
                          {TASK_OPTIONS.find((t) => t.id === task)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted uppercase font-semibold mb-2">
                      Channels
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {state.channels.map((channel) => (
                        <Badge
                          key={channel}
                          className="bg-surface-elevated text-text border border-border"
                        >
                          {CHANNEL_OPTIONS.find((c) => c.id === channel)?.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted">
                  You can update these settings anytime in Settings.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex gap-4 mt-6 justify-between">
          <Button
            onClick={handleBack}
            variant="outline"
            disabled={state.step === 1}
            className="border-border text-text"
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="bg-accent hover:bg-accent/90 text-white"
          >
            {state.step === 6 ? (
              <>
                Enter dashboard <IconChevronRight className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                Next <IconChevronRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Onboarding;
