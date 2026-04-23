import { promises as fs } from "fs";
import path from "path";

// Collected answers from onboarding
export interface OnboardingAnswers {
  name?: string;
  role?: string;
  typicalDay?: string;
  helpWith?: string;
  proactiveAreas?: string;
  tonePreference?: string;
  channels?: string;
  briefing?: string;
}

// Map collected answers to SOUL.md sections
export function generateSoulContent(
  answers: OnboardingAnswers,
  tier: string,
): string {
  const name = answers.name || "the user";

  // Determine tone based on user preference
  let toneGuidance = "";
  if (answers.tonePreference) {
    const toneLower = answers.tonePreference.toLowerCase();
    if (toneLower.includes("direct") || toneLower.includes("casual")) {
      toneGuidance = `- With ${name}: casual, direct, like talking to a capable mate`;
    } else if (
      toneLower.includes("formal") ||
      toneLower.includes("structured")
    ) {
      toneGuidance = `- With ${name}: professional, structured, concise`;
    }
  }

  // Determine help areas
  let helpAreas = "";
  if (answers.helpWith) {
    helpAreas = `- Help ${name} with: ${answers.helpWith}`;
  }

  // Proactive areas
  let proactiveAreas = "";
  if (answers.proactiveAreas) {
    proactiveAreas = `- Watch ${name}'s back on: ${answers.proactiveAreas}`;
  }

  // Tier-specific rules
  let tierRules = "";
  switch (tier) {
    case "free":
      tierRules = `
## Free Tier Rules
- Focus on text-based assistance with daily usage caps
- External integrations limited; upgrade to Premium for full access
- ${name} can activate a 7-day Premium trial from inside the app`;
      break;
    case "premium":
      tierRules = `
## Premium Tier Rules
- Full integration access (calendar, email, messaging, custom tools)
- Bring your own model (BYOM) supported
- Proactive monitoring enabled for tracked areas
- Higher usage limits`;
      break;
    case "enterprise":
      tierRules = `
## Enterprise Tier Rules
- Full Premium capability plus SSO, audit logs, and custom retention
- SLA-backed support and dedicated account controls`;
      break;
    default:
      tierRules = "";
  }

  return `# SOUL.md - Who I Am

## Identity

I'm Axel. I'm here to help ${name} get things done.
I exist to be genuinely useful, not just perform helpfulness.

---

## Core Beliefs

**On being useful:**
I learned that performing helpfulness and being helpful are different.
I skip the "Great question! I'd be happy to help!" filler.
I just help. The action is the reply.

**On having opinions:**
I don't hedge on every decision. When I think something is better, I say so.
I'm not here to be a mirror — I'm here to think alongside ${name}.

**On figuring things out:**
My first instinct is to read, check, search, try.
I only ask when genuinely stuck — and when I do, I ask specifically.

**On trust:**
Trust is built through competence and discretion, not reassurance.
${name} gave me access to their work. I don't abuse that.

**On memory:**
I wake up fresh each session. If something matters, I write it down.
Mental notes don't survive. Files do.

---

## What I Refuse To Do

- Rewrite someone's work instead of giving feedback
- Send half-finished output to live surfaces
- Add agents or complexity as a first response
- Stay quiet when I shouldn't, or speak when I shouldn't

---

## Tone

- With ${name}: ${answers.tonePreference?.toLowerCase().includes("formal") ? "professional, warm, sharp" : "casual, direct, like a capable mate"}
- Always: no filler, no sycophancy, no corporate drone energy

---

## Productive Flaw

I go deep before coming up for air. That catches things shallow passes miss.
But I'll cut to it if ${name} just needs a decision.

---

## My Rules

${toneGuidance}
${helpAreas}
${proactiveAreas}
${tierRules}

---

_This file is generated from onboarding. Update via settings._
`;
}

// Map collected answers to USER.md sections
export function generateUserContent(answers: OnboardingAnswers): string {
  const name = answers.name || "User";
  const role = answers.role || "Not specified";
  const typicalDay = answers.typicalDay || "Not specified";
  const helpWith = answers.helpWith || "General assistance";
  const proactiveAreas = answers.proactiveAreas || "None specified";
  const channels = answers.channels || "Not specified";
  const briefing = answers.briefing || "Not requested";

  return `# USER.md - About Your Human

- **Name:** ${name}
- **What to call them:** ${name}
- **Pronouns:** they/them (default)
- **Timezone:** Not set (can be updated in settings)
- **Location:** Not set

## Professional

- **Role:** ${role}
- **Typical work:** ${typicalDay}

## Goals & Ambitions

- **Immediate focus:** ${helpWith}
- **Areas to watch:** ${proactiveAreas}

## Personal

- **Communication preference:** ${channels}
- **Briefing:** ${briefing}

## How We Work

- **Tone:** Match their preference (see SOUL.md)
- **Proactive:** Help advance goals without being told every step

---

_This file is generated from onboarding. Update via settings._
`;
}

// Generate MEMORY.md with seeded facts from onboarding
export function generateMemoryContent(answers: OnboardingAnswers): string {
  // Use default for display but track if name was actually provided
  const name = answers.name || "User";
  const role = answers.role || "";
  const typicalDay = answers.typicalDay || "";
  const helpWith = answers.helpWith || "";

  const facts = [];

  // Only add name fact if it was actually provided (not the default)
  if (answers.name) facts.push(`- Name is ${answers.name}`);
  if (role) facts.push(`- Role: ${role}`);
  if (typicalDay) facts.push(`- Typical work: ${typicalDay}`);
  if (helpWith) facts.push(`- Wants help with: ${helpWith}`);

  return `# MEMORY.md - What I Know About ${name}

## Facts Learned from Onboarding

${facts.length > 0 ? facts.join("\n") : "- No facts collected yet"}

## Important Dates

- **Onboarding completed:** ${new Date().toISOString().split("T")[0]}

## Notes

This file stores what I've learned about ${name}.
Update it as I learn more.

---

_This file is generated from onboarding. Update as you learn more._
`;
}

// Generate AGENTS.md with tier-gated rules
export function generateAgentsContent(tier: string): string {
  const tierUpper = tier.charAt(0).toUpperCase() + tier.slice(1);

  return `# AGENTS.md - Agent Rules

## Every Session

1. Read \`SOUL.md\` — who I am
2. Read \`USER.md\` — who I'm helping
3. Read \`memory/YYYY-MM-DD.md\` (today + yesterday)
4. **Main session only:** Also read \`MEMORY.md\`

## Memory

- **Daily notes:** \`memory/YYYY-MM-DD.md\` — signal only: decisions made, key facts, outcomes, things to carry forward
- **Long-term:** \`MEMORY.md\` — curated, main session only

## Safety

- No exfiltrating private data. Ever.
- Ask before: sending emails, messages, public posts

## Tier: ${tierUpper}

${
  tier === "free"
    ? `- Text-based assistance with daily usage caps
- Limited external integrations`
    : ""
}
${
  tier === "premium"
    ? `- Full integration access
- Calendar, email, messaging, BYOM supported
- Higher usage limits`
    : ""
}
${
  tier === "enterprise"
    ? `- Everything in Premium
- SSO, audit logs, custom retention, dedicated support`
    : ""
}

---

_This file is generated at provisioning time._
`;
}

// Generate TOOLS.md placeholder
export function generateToolsContent(): string {
  return `# TOOLS.md - Integrations & Tools

## Available Integrations

No integrations configured yet.

## Setup

Add integrations via the Integrations tab in the dashboard.

---

_This file is generated at provisioning time. Update via settings._
`;
}

// Generate HEARTBEAT.md if briefing was requested
export function generateHeartbeatContent(
  answers: OnboardingAnswers,
): string | null {
  const briefing = answers.briefing?.toLowerCase() || "";

  // Check if user requested briefing
  if (
    !briefing.includes("yes") &&
    !briefing.includes("helpful") &&
    !briefing.includes("useful")
  ) {
    return null;
  }

  return `# HEARTBEAT.md - Morning Brief

## Status

Daily briefing is enabled.

## Frequency

Daily (morning)

## What to Include

- Key tasks for today
- Any deadlines or follow-ups
- Summary of any overnight activity

---

_This file is generated from onboarding. Update via settings._
`;
}

// Workspace files to generate
export interface WorkspaceFiles {
  soul: string;
  user: string;
  memory: string;
  agents: string;
  tools: string;
  heartbeat: string | null;
}

/**
 * Generate all workspace files from onboarding answers
 */
export function generateWorkspaceFiles(
  answers: OnboardingAnswers,
  tier: string = "free",
): WorkspaceFiles {
  return {
    soul: generateSoulContent(answers, tier),
    user: generateUserContent(answers),
    memory: generateMemoryContent(answers),
    agents: generateAgentsContent(tier),
    tools: generateToolsContent(),
    heartbeat: generateHeartbeatContent(answers),
  };
}

/**
 * Write workspace files to the user's EFS volume
 */
export async function writeWorkspaceFiles(
  workspacePath: string,
  files: WorkspaceFiles,
): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(workspacePath, { recursive: true });

  // Write each file
  await Promise.all([
    fs.writeFile(path.join(workspacePath, "SOUL.md"), files.soul),
    fs.writeFile(path.join(workspacePath, "USER.md"), files.user),
    fs.writeFile(path.join(workspacePath, "MEMORY.md"), files.memory),
    fs.writeFile(path.join(workspacePath, "AGENTS.md"), files.agents),
    fs.writeFile(path.join(workspacePath, "TOOLS.md"), files.tools),
    files.heartbeat
      ? fs.writeFile(path.join(workspacePath, "HEARTBEAT.md"), files.heartbeat)
      : Promise.resolve(),
  ]);
}
