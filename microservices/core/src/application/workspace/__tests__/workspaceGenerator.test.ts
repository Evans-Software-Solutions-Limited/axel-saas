import { describe, it, expect } from "vitest";
import {
  generateWorkspaceFiles,
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

    it("should handle empty answers with defaults", () => {
      const memory = generateMemoryContent({});

      // When name is empty, defaults to "User"
      expect(memory).toContain("What I Know About User");
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
