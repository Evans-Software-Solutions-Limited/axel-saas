import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@axel-saas/db";

// Mock db before importing - this is required for the module to load
vi.mock("@axel-saas/db", async () => {
  const actual =
    await vi.importActual<typeof import("@axel-saas/db")>("@axel-saas/db");
  return {
    ...actual,
    getDb: vi.fn(() => ({})),
  };
});

// Import the actual module - constants are exported without database calls
import {
  REQUIRED_QUESTIONS,
  QUESTION_PROMPTS,
  ALL_QUESTIONS,
  OnboardingRepository,
} from "../onboardingRepository";

/**
 * Creates a fluent chain that:
 * - Returns itself from all query builder methods
 * - Is directly awaitable
 * - Returns a real Promise from `.returning()`
 */
function mockChain<T>(result: T | T[]) {
  const chain: Record<string, unknown> = {};
  const resultArray = Array.isArray(result) ? result : [result];
  const promise = Promise.resolve(resultArray);

  const fluent = [
    "values",
    "set",
    "from",
    "where",
    "limit",
    "offset",
    "orderBy",
    "leftJoin",
    "innerJoin",
  ];

  for (const method of fluent) {
    chain[method] = () => chain;
  }

  chain["returning"] = () => promise;
  chain["then"] = (
    resolve: Parameters<Promise<typeof resultArray>["then"]>[0],
    reject?: Parameters<Promise<typeof resultArray>["then"]>[1],
  ) => promise.then(resolve, reject);
  chain["catch"] = (
    reject: Parameters<Promise<typeof resultArray>["catch"]>[0],
  ) => promise.catch(reject);

  return chain;
}

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
      expect(QUESTION_PROMPTS.proactiveAreas).toBeDefined();
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
      expect(QUESTION_PROMPTS.name.toLowerCase()).toContain("call you");
    });

    it("should have role prompt about their world and context", () => {
      expect(QUESTION_PROMPTS.role.toLowerCase()).toContain("world");
    });

    it("should have proactiveAreas prompt about monitoring and support", () => {
      expect(QUESTION_PROMPTS.proactiveAreas.toLowerCase()).toContain(
        "watching",
      );
    });

    it("should have helpWith prompt about what to take off their plate", () => {
      expect(QUESTION_PROMPTS.helpWith.toLowerCase()).toContain("plate");
    });

    it("should have channels prompt about communication channels", () => {
      expect(QUESTION_PROMPTS.channels.toLowerCase()).toContain("connected");
    });
  });

  describe("ALL_QUESTIONS", () => {
    it("should contain required questions", () => {
      REQUIRED_QUESTIONS.forEach((q) => {
        expect(ALL_QUESTIONS).toContain(q);
      });
    });

    it("should have 10 total questions", () => {
      expect(ALL_QUESTIONS.length).toBe(10);
    });

    it("should have typicalDay as anchor question appearing early (position 3)", () => {
      const typicalDayIndex = ALL_QUESTIONS.indexOf("typicalDay");
      expect(typicalDayIndex).toBe(2); // 0-indexed, so position 3
    });

    it("should start with name, then role, then typicalDay", () => {
      expect(ALL_QUESTIONS[0]).toBe("name");
      expect(ALL_QUESTIONS[1]).toBe("role");
      expect(ALL_QUESTIONS[2]).toBe("typicalDay");
    });

    it("should have proactiveAreas appearing after painPoints for job-discovery flow", () => {
      const painPointsIndex = ALL_QUESTIONS.indexOf("painPoints");
      const proactiveIndex = ALL_QUESTIONS.indexOf("proactiveAreas");
      expect(proactiveIndex).toBe(painPointsIndex + 1);
    });
  });
});

describe("OnboardingRepository Methods", () => {
  let mockDb: Partial<Db>;
  let repo: OnboardingRepository;
  const userId = "test-user-123";
  const NOW = new Date("2024-06-01T10:00:00.000Z");

  const mockState = {
    id: "state-1",
    userId,
    status: "not_started" as const,
    outstandingQuestions: ["name", "helpWith", "channels"],
    collectedAnswers: {},
    requiredFieldsCompleted: {
      name: false,
      helpWith: false,
      channels: false,
    },
    completedAt: null,
    lastMessageAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const mockMessage = {
    id: "msg-1",
    userId,
    role: "user" as const,
    content: "John",
    createdAt: NOW,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      select: vi.fn(() => mockChain([mockState])),
      insert: vi.fn(() => mockChain([mockState])),
      update: vi.fn(() => mockChain([])),
    } as unknown as Partial<Db>;
    repo = new OnboardingRepository(mockDb as Db);
  });

  describe("getOrCreateState", () => {
    it("should return existing state if found", async () => {
      const result = await repo.getOrCreateState(userId);
      expect(mockDb.select).toHaveBeenCalled();
      expect(result.id).toBe("state-1");
    });

    it("should create new state if not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockState]),
      );

      const result = await repo.getOrCreateState(userId);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(result.outstandingQuestions).toContain("name");
      expect(result.outstandingQuestions).toContain("helpWith");
      expect(result.outstandingQuestions).toContain("channels");
    });
  });

  describe("getState", () => {
    it("should return state when found", async () => {
      const result = await repo.getState(userId);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("state-1");
    });

    it("should return null when not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const result = await repo.getState(userId);
      expect(result).toBeNull();
    });
  });

  describe("getMessages", () => {
    it("should return messages for user", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockMessage]),
      );
      const results = await repo.getMessages(userId);
      expect(results.length).toBe(1);
      expect(results[0]?.id).toBe("msg-1");
    });

    it("should return empty array if no messages", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      const results = await repo.getMessages(userId);
      expect(results.length).toBe(0);
    });
  });

  describe("getStateWithMessages", () => {
    it("should return state and messages", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockState]))
        .mockReturnValueOnce(mockChain([mockMessage]));

      const result = await repo.getStateWithMessages(userId);
      expect(result.state?.id).toBe("state-1");
      expect(result.messages.length).toBe(1);
    });

    it("should return null state if not found", async () => {
      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([]))
        .mockReturnValueOnce(mockChain([]));

      const result = await repo.getStateWithMessages(userId);
      expect(result.state).toBeNull();
      expect(result.messages).toEqual([]);
    });
  });

  describe("addMessage", () => {
    it("should add user message and update state timestamp", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockMessage]),
      );
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const result = await repo.addMessage(userId, "user", "Hello");
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(result.id).toBe("msg-1");
    });

    it("should add assistant message", async () => {
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([{ ...mockMessage, role: "assistant" }]),
      );
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const result = await repo.addMessage(userId, "assistant", "Hi there");
      expect(result.role).toBe("assistant");
    });
  });

  describe("updateAnswer", () => {
    it("should update answer and mark question as answered", async () => {
      const updatedState = {
        ...mockState,
        status: "in_progress" as const,
        collectedAnswers: { name: "John" },
        requiredFieldsCompleted: {
          name: true,
          helpWith: false,
          channels: false,
        },
        outstandingQuestions: ["helpWith", "channels"],
      };

      (mockDb.select as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockChain([mockState]))
        .mockReturnValueOnce(mockChain([updatedState]));
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const result = await repo.updateAnswer(userId, "name", "John");
      expect(mockDb.update).toHaveBeenCalled();
      expect(result.collectedAnswers.name).toBe("John");
    });
  });

  describe("markCompleted", () => {
    it("should mark state as completed and update user", async () => {
      const completedState = {
        ...mockState,
        status: "completed" as const,
        outstandingQuestions: [],
        completedAt: NOW,
      };

      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );
      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([completedState]),
      );

      const result = await repo.markCompleted(userId);
      expect(mockDb.update).toHaveBeenCalled();
      expect(result.status).toBe("completed");
      expect(result.outstandingQuestions.length).toBe(0);
    });
  });

  describe("getNextQuestion", () => {
    it("should return first outstanding question", () => {
      const state = {
        outstandingQuestions: ["helpWith", "channels", "role"] as const,
      } as any;
      const nextQ = repo.getNextQuestion(state);
      expect(nextQ).toBe("helpWith");
    });

    it("should return null when no outstanding questions", () => {
      const state = {
        outstandingQuestions: [],
      } as any;
      const nextQ = repo.getNextQuestion(state);
      expect(nextQ).toBeNull();
    });
  });

  describe("isComplete", () => {
    it("should return false if required fields not completed", () => {
      const state = {
        requiredFieldsCompleted: {
          name: true,
          helpWith: false,
          channels: false,
        },
        status: "in_progress" as const,
      } as any;
      expect(repo.isComplete(state)).toBe(false);
    });

    it("should return false if status is not_started", () => {
      const state = {
        requiredFieldsCompleted: {
          name: true,
          helpWith: true,
          channels: true,
        },
        status: "not_started" as const,
      } as any;
      expect(repo.isComplete(state)).toBe(false);
    });

    it("should return true when all required fields completed and in progress", () => {
      const state = {
        requiredFieldsCompleted: {
          name: true,
          helpWith: true,
          channels: true,
        },
        status: "in_progress" as const,
      } as any;
      expect(repo.isComplete(state)).toBe(true);
    });

    it("should return false when completed status", () => {
      const state = {
        requiredFieldsCompleted: {
          name: true,
          helpWith: true,
          channels: true,
        },
        status: "completed" as const,
      } as any;
      expect(repo.isComplete(state)).toBe(false);
    });
  });

  describe("generateAssistantResponse", () => {
    it("should ask initial greeting on first message", () => {
      const state = {
        status: "not_started" as const,
        outstandingQuestions: ["name"],
      } as any;
      const response = repo.generateAssistantResponse(state, "");
      expect(response.toLowerCase()).toContain("set up");
      expect(response).toContain(
        "Before I can be useful, what should I call you?",
      );
    });

    it("should ask next outstanding question", () => {
      const state = {
        status: "in_progress" as const,
        outstandingQuestions: ["helpWith"],
      } as any;
      const response = repo.generateAssistantResponse(state, "John");
      expect(response).toBe(
        "What brought you here? What's something you'd like me to take off your plate or help you think through?",
      );
    });

    it("should return completion message when no questions left", () => {
      const state = {
        status: "in_progress" as const,
        outstandingQuestions: [],
      } as any;
      const response = repo.generateAssistantResponse(state, "");
      expect(response.toLowerCase()).toContain("all set");
    });
  });

  describe("processMessage", () => {
    it("should process message and update state", async () => {
      const updatedState = {
        ...mockState,
        status: "in_progress" as const,
        collectedAnswers: { name: "John" },
        requiredFieldsCompleted: {
          name: true,
          helpWith: false,
          channels: false,
        },
        outstandingQuestions: ["helpWith", "channels"],
      };

      const selectMock = vi.fn();
      (mockDb.select as ReturnType<typeof vi.fn>) = selectMock;
      selectMock
        .mockReturnValueOnce(mockChain([mockState])) // getOrCreateState
        .mockReturnValueOnce(mockChain([mockState])) // updateAnswer: get current state
        .mockReturnValueOnce(mockChain([updatedState])) // updateAnswer: get updated state
        .mockReturnValueOnce(mockChain([updatedState])) // getState after updateAnswer
        .mockReturnValueOnce(mockChain([mockMessage])); // getMessages

      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockMessage]),
      );
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const result = await repo.processMessage(userId, "John");
      expect(result.isComplete).toBe(false);
      expect(result.state.status).toBe("in_progress");
    });

    it("should mark complete when all required questions answered", async () => {
      // State just before answering the last required question
      const almostCompleteState = {
        ...mockState,
        status: "in_progress" as const,
        collectedAnswers: { name: "John", helpWith: "productivity" },
        requiredFieldsCompleted: {
          name: true,
          helpWith: true,
          channels: false,
        },
        outstandingQuestions: ["channels", "role", "typicalDay"],
      };

      // State after answering all required questions (but before marking complete)
      const allRequiredAnsweredState = {
        ...almostCompleteState,
        collectedAnswers: {
          name: "John",
          helpWith: "productivity",
          channels: "Slack",
        },
        requiredFieldsCompleted: {
          name: true,
          helpWith: true,
          channels: true,
        },
        outstandingQuestions: ["role", "typicalDay"],
      };

      // Final state after markCompleted
      const completedState = {
        ...allRequiredAnsweredState,
        status: "completed" as const,
        outstandingQuestions: [],
        completedAt: NOW,
      };

      const selectMock = vi.fn();
      (mockDb.select as ReturnType<typeof vi.fn>) = selectMock;
      selectMock
        .mockReturnValueOnce(mockChain([almostCompleteState])) // getOrCreateState
        .mockReturnValueOnce(mockChain([almostCompleteState])) // updateAnswer: get current state
        .mockReturnValueOnce(mockChain([allRequiredAnsweredState])) // updateAnswer: get updated state
        .mockReturnValueOnce(mockChain([allRequiredAnsweredState])) // getState after updateAnswer
        .mockReturnValueOnce(mockChain([completedState])) // markCompleted: getState after update
        .mockReturnValueOnce(mockChain([mockMessage])); // getMessages
      (mockDb.insert as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([mockMessage]),
      );
      (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue(
        mockChain([]),
      );

      const result = await repo.processMessage(userId, "Slack");
      expect(result.isComplete).toBe(true);
      expect(result.state.status).toBe("completed");
    });

    it("should reject POST message when onboarding already completed", async () => {
      const completedState = {
        ...mockState,
        status: "completed" as const,
        outstandingQuestions: [],
        completedAt: NOW,
      };

      (mockDb.select as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        mockChain([completedState]),
      ); // getOrCreateState

      await expect(repo.processMessage(userId, "New message")).rejects.toThrow(
        "Onboarding already completed for this user",
      );
    });
  });
});
