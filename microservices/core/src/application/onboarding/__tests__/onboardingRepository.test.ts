import { describe, it, expect } from "vitest";

// Mock db before importing - this is required for the module to load
vi.mock("@axel-saas/db", () => ({
  getDb: vi.fn(() => ({})),
  onboardingState: "onboardingState",
  onboardingMessages: "onboardingMessages",
  users: "users",
}));

// Import the actual module - constants are exported without database calls
import { REQUIRED_QUESTIONS, QUESTION_PROMPTS } from "../onboardingRepository";

describe("OnboardingRepository Constants", () => {
  describe("REQUIRED_QUESTIONS", () => {
    it("should have name as required", () => {
      expect(REQUIRED_QUESTIONS).toContain("name");
    });

    it("should have helpWith as required", () => {
      expect(REQUIRED_QUESTIONS).toContain("helpWith");
    });

    it("should have channels as required", () => {
      expect(REQUIRED_QUESTIONS).toContain("channels");
    });

    it("should have exactly 3 required questions", () => {
      expect(REQUIRED_QUESTIONS.length).toBe(3);
    });
  });

  describe("QUESTION_PROMPTS", () => {
    it("should have prompts for all required questions", () => {
      expect(QUESTION_PROMPTS.name).toBeDefined();
      expect(QUESTION_PROMPTS.helpWith).toBeDefined();
      expect(QUESTION_PROMPTS.channels).toBeDefined();
    });

    it("should have prompts for optional questions", () => {
      expect(QUESTION_PROMPTS.role).toBeDefined();
      expect(QUESTION_PROMPTS.typicalDay).toBeDefined();
      expect(QUESTION_PROMPTS.painPoints).toBeDefined();
      expect(QUESTION_PROMPTS.whatToTeach).toBeDefined();
      expect(QUESTION_PROMPTS.tonePreference).toBeDefined();
      expect(QUESTION_PROMPTS.morningBrief).toBeDefined();
      expect(QUESTION_PROMPTS.briefTime).toBeDefined();
    });

    it("should have non-empty prompts", () => {
      for (const [, prompt] of Object.entries(QUESTION_PROMPTS)) {
        expect(prompt.length).toBeGreaterThan(0);
      }
    });

    it("should have name prompt asking for name", () => {
      expect(QUESTION_PROMPTS.name.toLowerCase()).toContain("call");
    });

    it("should have helpWith prompt about helping", () => {
      expect(QUESTION_PROMPTS.helpWith.toLowerCase()).toContain("help");
    });

    it("should have channels prompt about channels", () => {
      expect(QUESTION_PROMPTS.channels.toLowerCase()).toContain("channel");
    });
  });
});
