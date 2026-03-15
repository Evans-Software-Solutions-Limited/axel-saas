import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import {
  generateWorkspaceFiles,
  writeWorkspaceFiles,
  generateSoulContent,
  generateUserContent,
  generateMemoryContent,
  generateAgentsContent,
  generateToolsContent,
  generateHeartbeatContent,
} from "../workspaceGenerator";

describe("workspaceGenerator", () => {
  const sampleAnswers = {
    name: "Bradley",
    role: "Software Engineer",
    typicalDay: "Coding, meetings, code reviews",
    helpWith: "Coding tasks, debugging, technical writing",
    proactiveAreas: "Deadline tracking, code review follow-ups",
    tonePreference: "Casual and direct",
    channels: "Slack and Email",
    briefing: "Yes, daily briefings would be helpful",
  };

  describe("generateSoulContent", () => {
    it("should generate SOUL.md with user name and preferences", () => {
      const soul = generateSoulContent(sampleAnswers, "starter");

      expect(soul).toContain("I'm Axel");
      expect(soul).toContain("Bradley");
      expect(soul).toContain("casual, direct");
      expect(soul).toContain("Help Bradley with:");
      expect(soul).toContain("Watch Bradley's back on:");
    });

    it("should include tier-specific rules for starter tier", () => {
      const soul = generateSoulContent(sampleAnswers, "starter");

      expect(soul).toContain("Starter Tier Rules");
      expect(soul).toContain("Focus on text-based assistance");
    });

    it("should include tier-specific rules for pro tier", () => {
      const soul = generateSoulContent(sampleAnswers, "pro");

      expect(soul).toContain("Pro Tier Rules");
      expect(soul).toContain("Full integration access");
    });

    it("should include tier-specific rules for business tier", () => {
      const soul = generateSoulContent(sampleAnswers, "business");

      expect(soul).toContain("Business Tier Rules");
    });

    it("should include tier-specific rules for developer tier", () => {
      const soul = generateSoulContent(sampleAnswers, "developer");

      expect(soul).toContain("Developer Tier Rules");
      expect(soul).toContain("execute shell commands");
    });

    it("should handle missing answers gracefully", () => {
      const soul = generateSoulContent({}, "starter");

      expect(soul).toContain("I'm Axel");
      expect(soul).toContain("the user");
    });

    it("should map formal tone preference correctly", () => {
      const soul = generateSoulContent({ tonePreference: "formal" }, "starter");

      expect(soul).toContain("professional, structured, concise");
    });

    it("should handle tone preference with 'direct' keyword", () => {
      const soul = generateSoulContent(
        { tonePreference: "very direct" },
        "starter",
      );

      expect(soul).toContain("casual, direct");
    });
  });

  describe("generateUserContent", () => {
    it("should generate USER.md with all collected answers", () => {
      const user = generateUserContent(sampleAnswers);

      expect(user).toContain("Bradley");
      expect(user).toContain("Software Engineer");
      expect(user).toContain("Coding, meetings, code reviews");
      expect(user).toContain("Slack and Email");
      expect(user).toContain("daily briefings would be helpful");
    });

    it("should handle missing answers with defaults", () => {
      const user = generateUserContent({});

      expect(user).toContain("User");
      expect(user).toContain("Not specified");
    });
  });

  describe("generateMemoryContent", () => {
    it("should generate MEMORY.md with facts from onboarding", () => {
      const memory = generateMemoryContent(sampleAnswers);

      expect(memory).toContain("Facts Learned from Onboarding");
      expect(memory).toContain("Name is Bradley");
      expect(memory).toContain("Role: Software Engineer");
      expect(memory).toContain("Wants help with:");
    });

    it("should show 'No facts collected yet' when no answers provided", () => {
      const memory = generateMemoryContent({});

      // When name is empty, defaults to "User" for display
      expect(memory).toContain("What I Know About User");
      // But no facts should be collected
      expect(memory).toContain("- No facts collected yet");
    });

    it("should only add name fact when name was actually provided", () => {
      // Provide name but no other fields
      const memory = generateMemoryContent({ name: "Alice" });

      expect(memory).toContain("Name is Alice");
      // Role, typicalDay, helpWith are not provided, so they shouldn't appear
      expect(memory).not.toContain("Role:");
      expect(memory).not.toContain("Typical work:");
      expect(memory).not.toContain("Wants help with:");
    });
  });

  describe("generateAgentsContent", () => {
    it("should generate AGENTS.md for starter tier", () => {
      const agents = generateAgentsContent("starter");

      expect(agents).toContain("Tier: Starter");
      expect(agents).toContain("Text-based assistance only");
    });

    it("should generate AGENTS.md for pro tier", () => {
      const agents = generateAgentsContent("pro");

      expect(agents).toContain("Tier: Pro");
      expect(agents).toContain("Full integration access");
    });

    it("should generate AGENTS.md for developer tier", () => {
      const agents = generateAgentsContent("developer");

      expect(agents).toContain("Tier: Developer");
      expect(agents).toContain("Developer mode enabled");
    });

    it("should generate AGENTS.md for business tier", () => {
      const agents = generateAgentsContent("business");

      expect(agents).toContain("Tier: Business");
      expect(agents).toContain("Full business features");
    });

    it("should handle unknown tier gracefully", () => {
      const agents = generateAgentsContent("unknown");

      expect(agents).toContain("Tier: Unknown");
    });
  });

  describe("generateToolsContent", () => {
    it("should generate placeholder TOOLS.md", () => {
      const tools = generateToolsContent();

      expect(tools).toContain("Available Integrations");
      expect(tools).toContain("No integrations configured yet");
    });
  });

  describe("generateHeartbeatContent", () => {
    it("should return HEARTBEAT.md when briefing is requested", () => {
      const heartbeat = generateHeartbeatContent({
        briefing: "Yes, daily briefings would be helpful",
      });

      expect(heartbeat).not.toBeNull();
      expect(heartbeat).toContain("Morning Brief");
      expect(heartbeat).toContain("Daily briefing is enabled");
    });

    it("should return null when briefing is not requested", () => {
      const heartbeat = generateHeartbeatContent({
        briefing: "No thanks",
      });

      expect(heartbeat).toBeNull();
    });

    it("should return null when briefing is not specified", () => {
      const heartbeat = generateHeartbeatContent({});

      expect(heartbeat).toBeNull();
    });
  });

  describe("generateWorkspaceFiles", () => {
    it("should generate all workspace files", () => {
      const files = generateWorkspaceFiles(sampleAnswers, "starter");

      expect(files.soul).toBeTruthy();
      expect(files.user).toBeTruthy();
      expect(files.memory).toBeTruthy();
      expect(files.agents).toBeTruthy();
      expect(files.tools).toBeTruthy();
      expect(files.heartbeat).toBeTruthy();
    });

    it("should include tier in generated files", () => {
      const files = generateWorkspaceFiles(sampleAnswers, "pro");

      expect(files.soul).toContain("Pro Tier Rules");
      expect(files.agents).toContain("Tier: Pro");
    });
  });
});

describe("writeWorkspaceFiles", () => {
  it("should write all required files to disk", async () => {
    const tmpDir = await fs.mkdtemp(path.join(tmpdir(), "axel-ws-test-"));
    try {
      const files = generateWorkspaceFiles(sampleAnswers, "starter");
      await writeWorkspaceFiles(tmpDir, files);

      const [soul, user, memory, agents, tools] = await Promise.all([
        fs.readFile(path.join(tmpDir, "SOUL.md"), "utf-8"),
        fs.readFile(path.join(tmpDir, "USER.md"), "utf-8"),
        fs.readFile(path.join(tmpDir, "MEMORY.md"), "utf-8"),
        fs.readFile(path.join(tmpDir, "AGENTS.md"), "utf-8"),
        fs.readFile(path.join(tmpDir, "TOOLS.md"), "utf-8"),
      ]);

      expect(soul).toContain("I'm Axel");
      expect(user).toContain("Bradley");
      expect(memory).toContain("Facts Learned from Onboarding");
      expect(agents).toContain("Tier: Starter");
      expect(tools).toContain("No integrations configured yet");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("should write HEARTBEAT.md when briefing is requested", async () => {
    const tmpDir = await fs.mkdtemp(path.join(tmpdir(), "axel-ws-test-"));
    try {
      const files = generateWorkspaceFiles(sampleAnswers, "starter");
      expect(files.heartbeat).not.toBeNull();
      await writeWorkspaceFiles(tmpDir, files);

      const heartbeat = await fs.readFile(
        path.join(tmpDir, "HEARTBEAT.md"),
        "utf-8",
      );
      expect(heartbeat).toContain("Morning Brief");
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("should not create HEARTBEAT.md when briefing was not requested", async () => {
    const tmpDir = await fs.mkdtemp(path.join(tmpdir(), "axel-ws-test-"));
    try {
      const files = generateWorkspaceFiles({ name: "Jane" }, "starter");
      expect(files.heartbeat).toBeNull();
      await writeWorkspaceFiles(tmpDir, files);

      const heartbeatExists = await fs
        .access(path.join(tmpDir, "HEARTBEAT.md"))
        .then(() => true)
        .catch(() => false);
      expect(heartbeatExists).toBe(false);
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  it("should create nested workspace directory if it does not exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(tmpdir(), "axel-ws-test-"));
    const nestedPath = path.join(tmpDir, "user-abc", "workspace");
    try {
      const files = generateWorkspaceFiles({}, "starter");
      await writeWorkspaceFiles(nestedPath, files);

      const soul = await fs.readFile(path.join(nestedPath, "SOUL.md"), "utf-8");
      expect(soul).toBeTruthy();
    } finally {
      await fs.rm(tmpDir, { recursive: true });
    }
  });

  const sampleAnswers = {
    name: "Bradley",
    role: "Software Engineer",
    typicalDay: "Coding, meetings, code reviews",
    helpWith: "Coding tasks, debugging, technical writing",
    proactiveAreas: "Deadline tracking, code review follow-ups",
    tonePreference: "Casual and direct",
    channels: "Slack and Email",
    briefing: "Yes, daily briefings would be helpful",
  };
});
