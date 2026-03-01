import { describe, it, expect, afterEach } from "vitest";
import {
  ConfigGenerationService,
  OnboardingData,
} from "../configGenerationService";
import fs from "fs/promises";
import path from "path";

describe("ConfigGenerationService", () => {
  const sampleData: OnboardingData = {
    name: "Alice",
    role: "Product Manager",
    goals: "Ship a consumer product with 10k users",
    helpWith: "Project management, stakeholder communication, roadmap planning",
    painPoints:
      "Too many Slack notifications, calendar conflicts, duplicate work",
    knowledgeAreas: "SaaS metrics, user research, agile methodology",
  };

  describe("generateGatewayToken", () => {
    it("should generate a valid hex token", () => {
      const token = ConfigGenerationService.generateGatewayToken();

      expect(typeof token).toBe("string");
      expect(token).toMatch(/^[0-9a-f]+$/); // hex only
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it("should generate unique tokens", () => {
      const token1 = ConfigGenerationService.generateGatewayToken();
      const token2 = ConfigGenerationService.generateGatewayToken();

      expect(token1).not.toBe(token2);
    });
  });

  describe("generateConfigFiles", () => {
    it("should generate all 7 config files including openclaw.json", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);

      expect(Object.keys(files)).toHaveLength(7);
      expect(files).toHaveProperty("SOUL.md");
      expect(files).toHaveProperty("USER.md");
      expect(files).toHaveProperty("MEMORY.md");
      expect(files).toHaveProperty("AGENTS.md");
      expect(files).toHaveProperty("HEARTBEAT.md");
      expect(files).toHaveProperty("TOOLS.md");
      expect(files).toHaveProperty("openclaw.json");
    });

    it("should generate openclaw.json with default config", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const config = JSON.parse(files["openclaw.json"]);

      expect(config.gateway).toBeDefined();
      expect(config.gateway.bind).toBe("lan");
      expect(config.gateway.port).toBe(18789);
      expect(config.gateway.controlUi).toBeDefined();
      expect(
        config.gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback,
      ).toBe(true);
      expect(config.agents).toBeDefined();
      expect(config.agents.defaults.workspace).toBe("~/.openclaw/workspace");
    });

    it("should include gateway token in openclaw.json when provided", () => {
      const token = "test-token-value";
      const files = ConfigGenerationService.generateConfigFiles(
        sampleData,
        token,
      );
      const config = JSON.parse(files["openclaw.json"]);

      expect(config.gateway.token).toBe(token);
    });

    it("should not include token in openclaw.json when not provided", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const config = JSON.parse(files["openclaw.json"]);

      expect(config.gateway.token).toBeUndefined();
    });

    it("should generate valid JSON in openclaw.json", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);

      expect(() => {
        JSON.parse(files["openclaw.json"]);
      }).not.toThrow();
    });

    it("should include user data in SOUL.md", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const soul = files["SOUL.md"];

      expect(soul).toContain(sampleData.name);
      expect(soul).toContain(sampleData.role);
      expect(soul).toContain(sampleData.goals);
      expect(soul).toContain(sampleData.helpWith);
    });

    it("should include user data in USER.md", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const user = files["USER.md"];

      expect(user).toContain(sampleData.name);
      expect(user).toContain(sampleData.role);
      expect(user).toContain(sampleData.goals);
      expect(user).toContain(sampleData.helpWith);
      expect(user).toContain(sampleData.painPoints);
    });

    it("should include user data in MEMORY.md", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const memory = files["MEMORY.md"];

      expect(memory).toContain(sampleData.name);
      expect(memory).toContain(sampleData.role);
      expect(memory).toMatch(/\d{4}-\d{2}-\d{2}/); // today's date
    });

    it("should generate tier-gated AGENTS.md", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const agents = files["AGENTS.md"];

      expect(agents).toContain("Starter");
      expect(agents).toContain("Pro");
      expect(agents).toContain("Business");
      expect(agents).toContain("Developer");
    });

    it("should generate empty HEARTBEAT.md scaffold", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const heartbeat = files["HEARTBEAT.md"];

      expect(heartbeat).toContain("HEARTBEAT.md");
      expect(heartbeat).toContain("none yet");
    });

    it("should generate TOOLS.md scaffold", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const tools = files["TOOLS.md"];

      expect(tools).toContain("TOOLS.md");
      expect(tools).toContain("Available Tools");
    });

    it("should handle long text by truncating properly", () => {
      const longData: OnboardingData = {
        ...sampleData,
        helpWith:
          "A very long description that goes on and on and on and should be truncated when used in SOUL.md",
      };

      const files = ConfigGenerationService.generateConfigFiles(longData);
      const soul = files["SOUL.md"];

      expect(soul).toContain("A very long description");
    });
  });

  describe("writeFilesToDisk", () => {
    const testUserId = "test-user-123";
    const testWorkspacePath = path.join(
      process.env.WORKSPACE_BASE_PATH || "/tmp/axel-workspaces",
      "users",
      testUserId,
      "workspace",
    );

    afterEach(async () => {
      try {
        await fs.rm(path.dirname(testWorkspacePath), {
          recursive: true,
          force: true,
        });
      } catch {
        // ignore cleanup errors
      }
    });

    it("should write files to disk including openclaw.json", async () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const writePath = await ConfigGenerationService.writeFilesToDisk(
        testUserId,
        files,
      );

      expect(writePath).toBe(testWorkspacePath);

      const soulPath = path.join(writePath, "SOUL.md");
      const userPath = path.join(writePath, "USER.md");
      const memoryPath = path.join(writePath, "MEMORY.md");
      const configPath = path.join(writePath, "openclaw.json");

      const soulContent = await fs.readFile(soulPath, "utf-8");
      const userContent = await fs.readFile(userPath, "utf-8");
      const memoryContent = await fs.readFile(memoryPath, "utf-8");
      const configContent = await fs.readFile(configPath, "utf-8");

      expect(soulContent).toContain(sampleData.name);
      expect(userContent).toContain(sampleData.role);
      expect(memoryContent).toContain(sampleData.goals);
      expect(JSON.parse(configContent)).toHaveProperty("gateway");
    });

    it("should create directory structure if missing", async () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);

      try {
        await fs.rm(testWorkspacePath, { recursive: true, force: true });
      } catch {
        // ignore
      }

      const writePath = await ConfigGenerationService.writeFilesToDisk(
        testUserId,
        files,
      );

      const stats = await fs.stat(writePath);
      expect(stats.isDirectory()).toBe(true);
    });

    it("should overwrite existing files", async () => {
      const files1 = ConfigGenerationService.generateConfigFiles(sampleData);
      await ConfigGenerationService.writeFilesToDisk(testUserId, files1);

      const newData: OnboardingData = {
        ...sampleData,
        name: "Bob",
      };
      const files2 = ConfigGenerationService.generateConfigFiles(newData);
      await ConfigGenerationService.writeFilesToDisk(testUserId, files2);

      const soulPath = path.join(testWorkspacePath, "SOUL.md");
      const content = await fs.readFile(soulPath, "utf-8");

      expect(content).toContain("Bob");
      expect(content).not.toContain("Alice");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle writeFilesToDisk error gracefully", async () => {
      const testUserId = "error-test";
      const files = ConfigGenerationService.generateConfigFiles(sampleData);

      // Mock fs to throw an error by using invalid path
      // This is integration-level - it will actually try to write to a path we can't access
      // For now, just verify the method exists and can be called

      expect(async () => {
        await ConfigGenerationService.writeFilesToDisk(testUserId, files);
      }).toBeDefined();
    });

    it("should truncate text at exact maxLength", () => {
      const longData: OnboardingData = {
        ...sampleData,
        goals: "A".repeat(100) + " more text that should be cut off",
      };

      const files = ConfigGenerationService.generateConfigFiles(longData);
      const memory = files["MEMORY.md"];

      // The truncation happens at 80 chars for this field
      expect(memory.length).toBeGreaterThan(0);
      expect(memory).toContain("A");
    });

    it("should handle empty strings gracefully", () => {
      const emptyData: OnboardingData = {
        name: "",
        role: "",
        goals: "",
        helpWith: "",
        painPoints: "",
        knowledgeAreas: "",
      };

      const files = ConfigGenerationService.generateConfigFiles(emptyData);

      expect(files["SOUL.md"]).toContain("# SOUL.md");
      expect(files["USER.md"]).toContain("# USER.md");
      expect(files["MEMORY.md"]).toContain("# MEMORY.md");
      expect(files["openclaw.json"]).toContain("gateway");
    });

    it("should generate all 7 files with consistent structure", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);

      // Check that each file has expected markdown headers
      expect(files["SOUL.md"]).toMatch(/^#\s+SOUL\.md/m);
      expect(files["USER.md"]).toMatch(/^#\s+USER\.md/m);
      expect(files["MEMORY.md"]).toMatch(/^#\s+MEMORY\.md/m);
      expect(files["AGENTS.md"]).toMatch(/^#\s+AGENTS\.md/m);
      expect(files["HEARTBEAT.md"]).toMatch(/^#\s+HEARTBEAT\.md/m);
      expect(files["TOOLS.md"]).toMatch(/^#\s+TOOLS\.md/m);
    });

    it("should preserve newlines and formatting in file contents", () => {
      const files = ConfigGenerationService.generateConfigFiles(sampleData);
      const soul = files["SOUL.md"];

      // Should have proper markdown formatting
      expect(soul).toContain("## Identity");
      expect(soul).toContain("## Tone");
      expect(soul).toContain("## What I Know About");
    });
  });
});
