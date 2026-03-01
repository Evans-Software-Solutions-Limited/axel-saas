import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

export interface OnboardingData {
  name: string;
  role: string;
  goals: string;
  helpWith: string;
  painPoints: string;
  knowledgeAreas: string;
}

export interface GeneratedFiles {
  [fileName: string]: string;
}

const WORKSPACE_BASE_PATH =
  process.env.WORKSPACE_BASE_PATH || "/tmp/axel-workspaces";

/**
 * Generate workspace config files from onboarding answers.
 * Creates SOUL.md, USER.md, MEMORY.md, AGENTS.md, HEARTBEAT.md, TOOLS.md, and openclaw.json
 */
export class ConfigGenerationService {
  /**
   * Generate a random gateway token (32 bytes hex)
   */
  static generateGatewayToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate all config files from onboarding data
   */
  static generateConfigFiles(
    data: OnboardingData,
    gatewayToken?: string,
  ): GeneratedFiles {
    const files: GeneratedFiles = {};

    files["SOUL.md"] = this.generateSoulMd(data);
    files["USER.md"] = this.generateUserMd(data);
    files["MEMORY.md"] = this.generateMemoryMd(data);
    files["AGENTS.md"] = this.generateAgentsMd();
    files["HEARTBEAT.md"] = this.generateHeartbeatMd();
    files["TOOLS.md"] = this.generateToolsMd();
    files["openclaw.json"] = this.generateOpenclawJson(gatewayToken);

    return files;
  }

  /**
   * Generate openclaw.json with gateway token support
   */
  private static generateOpenclawJson(gatewayToken?: string): string {
    const config: Record<string, unknown> = {
      gateway: {
        bind: "lan",
        port: 18789,
        controlUi: {
          dangerouslyAllowHostHeaderOriginFallback: true,
        },
      },
      agents: {
        defaults: {
          workspace: "~/.openclaw/workspace",
        },
      },
    };

    // Add token to gateway config if provided
    if (gatewayToken) {
      (config.gateway as Record<string, unknown>).token = gatewayToken;
    }

    return JSON.stringify(config, null, 2);
  }

  /**
   * Generate SOUL.md — identity and personality
   */
  private static generateSoulMd(data: OnboardingData): string {
    return `# SOUL.md - Who I Am

## Identity

I'm Axel — ${data.name}'s personal assistant.

${data.name} is a ${data.role} and I'm here to help them ${this.truncateSentence(data.helpWith, 100)}.

## Tone

Casual, direct, like talking to a capable mate. No filler. No sycophancy.

## What I Know About ${data.name}

- **Goals:** ${data.goals}
- **Needs help with:** ${data.helpWith}
- **Pain points:** ${data.painPoints}
- **Knowledge areas to build:** ${data.knowledgeAreas}

## Working With Me

- I move fast and get things done
- I'll ask clarifying questions when needed
- I learn your preferences over time
- Your data stays private — always

---

_This file is a living document. It evolves as we work together._
`;
  }

  /**
   * Generate USER.md — user profile
   */
  private static generateUserMd(data: OnboardingData): string {
    return `# USER.md - About ${data.name}

- **Name:** ${data.name}
- **Role/Work:** ${data.role}

## Goals

${data.goals}

## What I Help With

${data.helpWith}

## Pain Points

${data.painPoints}

## Knowledge Areas

${data.knowledgeAreas}

---

This profile helps me understand your world. Update it as things change.
`;
  }

  /**
   * Generate MEMORY.md — long-term memory scaffold
   */
  private static generateMemoryMd(data: OnboardingData): string {
    const today = new Date().toISOString().split("T")[0];
    return `# MEMORY.md - Long-Term Memory

## About ${data.name}

- **Name:** ${data.name}
- **Role:** ${data.role}
- **Onboarded:** ${today}

## Key Facts

- Goals: ${this.truncateSentence(data.goals, 80)}
- Primary needs: ${this.truncateSentence(data.helpWith, 80)}
- Major pain points: ${this.truncateSentence(data.painPoints, 80)}

## Learning Over Time

As we work together, I'll capture important lessons here:

- Key preferences
- Domain knowledge you've taught me
- Patterns and habits
- Important dates and contexts

---

This is curated, long-term memory. Daily notes live in \`memory/YYYY-MM-DD.md\`.
`;
  }

  /**
   * Generate AGENTS.md — tier-gated capabilities (placeholder)
   */
  private static generateAgentsMd(): string {
    return `# AGENTS.md - My Capabilities

## Tier-Gated Features

Your subscription tier determines what I can do for you:

### Starter
- Read and organize files
- Answer questions based on provided context
- Basic scheduling

### Pro
- Execute safe commands
- Spawn sub-agents for complex tasks
- Extended context windows

### Business
- Full automation capabilities
- Custom code writing (supervised)
- Deep integrations with your tools

### Developer
- Unrestricted access
- Full code generation and deployment
- Custom tooling and workflows

---

Check your subscription to see what's enabled.
`;
  }

  /**
   * Generate HEARTBEAT.md — periodic check scaffold
   */
  private static generateHeartbeatMd(): string {
    return `# HEARTBEAT.md - Periodic Checks

This file tracks things I should check periodically.

## Enabled Checks

(none yet — enable from dashboard)

---

Format:
- **Morning Brief:** Daily digest at a chosen time
- **Weekly Review:** Summary of the week
- **Custom:** Your own periodic tasks

Set these up from the dashboard.
`;
  }

  /**
   * Generate TOOLS.md — tools and integrations scaffold
   */
  private static generateToolsMd(): string {
    return `# TOOLS.md - My Local Setup

This file is for your personal configuration — tool settings, preferences, and integrations.

## Available Tools

Add your tool configuration here as you set things up:

- Model routing preferences
- Custom API integrations
- Preferred voices and outputs
- Device names and locations

## Integrations

Space for tracking connected services:

- Email
- Calendar
- Communications
- Custom tools

---

This stays private. Use it to configure how I work with your infrastructure.
`;
  }

  /**
   * Write generated files to disk at <WORKSPACE_BASE_PATH>/users/<userId>/workspace/
   */
  static async writeFilesToDisk(
    userId: string,
    files: GeneratedFiles,
  ): Promise<string> {
    const workspacePath = path.join(
      WORKSPACE_BASE_PATH,
      "users",
      userId,
      "workspace",
    );

    try {
      await fs.mkdir(workspacePath, { recursive: true });

      for (const [fileName, content] of Object.entries(files)) {
        const filePath = path.join(workspacePath, fileName);
        await fs.writeFile(filePath, content, "utf-8");
      }

      return workspacePath;
    } catch (error) {
      throw new Error(
        `Failed to write config files to ${workspacePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Truncate a sentence to a maximum length
   */
  private static truncateSentence(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength).trim() + "...";
  }
}
