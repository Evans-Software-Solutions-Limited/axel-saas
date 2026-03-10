import { eq } from "drizzle-orm";
import {
  type Db,
  type OnboardingState,
  type OnboardingMessage,
  getDb,
  onboardingState,
  onboardingMessages,
  users,
} from "@axel-saas/db";

// Required onboarding questions - backend owns these
export const REQUIRED_QUESTIONS = ["name", "helpWith", "channels"] as const;

// All questions (required + optional) in order
export const ALL_QUESTIONS = [
  "name",
  "role",
  "helpWith",
  "typicalDay",
  "painPoints",
  "whatToTeach",
  "tonePreference",
  "channels",
  "morningBrief",
  "briefTime",
] as const;

export type QuestionKey = (typeof ALL_QUESTIONS)[number];

// Question prompts - what the assistant asks
export const QUESTION_PROMPTS: Record<QuestionKey, string> = {
  name: "What should I call you?",
  role: "What do you do for work?",
  helpWith: "What would you like me to help you with?",
  typicalDay: "What does a typical day look like for you?",
  painPoints:
    "What's frustrating you most right now? What takes up too much of your time?",
  whatToTeach:
    "What do you want to teach me? Any policies, preferences, or things I should know?",
  tonePreference:
    "How do you like to communicate? Casual, formal, or somewhere in between?",
  channels: "Which channels would you like to use to reach me?",
  morningBrief: "Would you like me to send you a morning brief?",
  briefTime: "What time works best for your morning brief?",
};

// Questions that require multiple values (arrays)
export const ARRAY_QUESTIONS: QuestionKey[] = ["helpWith", "channels"];

export type OnboardingStateWithMessages = {
  state: OnboardingState | null;
  messages: OnboardingMessage[];
};

// Initial outstanding questions for new users
function getInitialOutstandingQuestions(): QuestionKey[] {
  // Return required questions first, then optional
  return [
    ...REQUIRED_QUESTIONS,
    "role",
    "typicalDay",
    "painPoints",
    "whatToTeach",
    "tonePreference",
    "morningBrief",
    "briefTime",
  ];
}

export class OnboardingRepository {
  static readonly key = "OnboardingRepository";

  private db: Db;

  constructor(db?: Db) {
    this.db = db ?? getDb();
  }

  /**
   * Get or create onboarding state for a user
   */
  async getOrCreateState(userId: string): Promise<OnboardingState> {
    const [existing] = await this.db
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Create new onboarding state
    const [created] = await this.db.insert(onboardingState).values({
      userId,
      status: "not_started",
      outstandingQuestions: getInitialOutstandingQuestions(),
      collectedAnswers: {},
      requiredFieldsCompleted: {
        name: false,
        helpWith: false,
        channels: false,
      },
    });

    return created;
  }

  /**
   * Get onboarding state for a user (without creating)
   */
  async getState(userId: string): Promise<OnboardingState | null> {
    const [state] = await this.db
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.userId, userId))
      .limit(1);

    return state ?? null;
  }

  /**
   * Get all messages for a user in order
   */
  async getMessages(userId: string): Promise<OnboardingMessage[]> {
    return this.db
      .select()
      .from(onboardingMessages)
      .where(eq(onboardingMessages.userId, userId))
      .orderBy(onboardingMessages.createdAt);
  }

  /**
   * Get state with messages
   */
  async getStateWithMessages(
    userId: string,
  ): Promise<OnboardingStateWithMessages> {
    const [state, messages] = await Promise.all([
      this.getState(userId),
      this.getMessages(userId),
    ]);

    return { state, messages };
  }

  /**
   * Add a message to the onboarding conversation
   */
  async addMessage(
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<OnboardingMessage> {
    const [message] = await this.db.insert(onboardingMessages).values({
      userId,
      role,
      content,
    });

    // Update lastMessageAt on state
    await this.db
      .update(onboardingState)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(onboardingState.userId, userId));

    return message;
  }

  /**
   * Update onboarding state with a collected answer
   */
  async updateAnswer(
    userId: string,
    question: QuestionKey,
    answer: string,
  ): Promise<OnboardingState> {
    const state = await this.getOrCreateState(userId);

    // Update status if not started
    let status = state.status;
    if (status === "not_started") {
      status = "in_progress";
    }

    // Update collected answers
    const collectedAnswers = { ...state.collectedAnswers, [question]: answer };

    // Update required fields completion
    const requiredFieldsCompleted = { ...state.requiredFieldsCompleted };
    const reqQuestions = [...REQUIRED_QUESTIONS] as string[];
    if (reqQuestions.includes(question)) {
      requiredFieldsCompleted[
        question as keyof typeof requiredFieldsCompleted
      ] = answer.trim().length > 0;
    }

    // Update outstanding questions - remove answered question
    const outstandingQuestions = state.outstandingQuestions.filter(
      (q) => q !== question,
    );

    await this.db
      .update(onboardingState)
      .set({
        status,
        collectedAnswers,
        requiredFieldsCompleted,
        outstandingQuestions,
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.userId, userId));

    // Return updated state
    const [updated] = await this.db
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.userId, userId))
      .limit(1);

    return updated;
  }

  /**
   * Determine if onboarding is complete based on collected answers
   * Backend-owned decision logic
   */
  isComplete(state: OnboardingState): boolean {
    // Check all required fields are completed
    const requiredCompleted = REQUIRED_QUESTIONS.every(
      (q) => state.requiredFieldsCompleted[q] === true,
    );

    return requiredCompleted && state.status === "in_progress";
  }

  /**
   * Mark onboarding as completed
   */
  async markCompleted(userId: string): Promise<OnboardingState> {
    const completedAt = new Date();

    await this.db
      .update(onboardingState)
      .set({
        status: "completed",
        completedAt,
        outstandingQuestions: [],
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.userId, userId));

    // Also update the main users table
    await this.db
      .update(users)
      .set({ onboardingCompleted: true, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Get the updated state
    const [updated] = await this.db
      .select()
      .from(onboardingState)
      .where(eq(onboardingState.userId, userId))
      .limit(1);

    return updated;
  }

  /**
   * Get the next question to ask (first outstanding)
   */
  getNextQuestion(state: OnboardingState): QuestionKey | null {
    if (state.outstandingQuestions.length === 0) {
      return null;
    }
    return state.outstandingQuestions[0] as QuestionKey;
  }

  /**
   * Generate assistant response based on current state
   */
  generateAssistantResponse(
    state: OnboardingState,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userMessage: string,
  ): string {
    const nextQuestion = this.getNextQuestion(state);

    // If no more questions, onboarding is complete
    if (!nextQuestion) {
      return "I've got everything I need. You're all set!";
    }

    // Get the prompt for the next question
    const prompt = QUESTION_PROMPTS[nextQuestion];

    // Check if this is the first message
    const isFirst = state.status === "not_started";

    if (isFirst) {
      return `Hey there! I've just been set up for you. Before I can be useful, I need to get to know you a bit. ${prompt}`;
    }

    return prompt;
  }

  /**
   * Process a user onboarding message - the main entry point
   */
  async processMessage(
    userId: string,
    userMessage: string,
  ): Promise<{
    state: OnboardingState;
    messages: OnboardingMessage[];
    assistantResponse: string;
    isComplete: boolean;
  }> {
    // Get or create state
    const state = await this.getOrCreateState(userId);

    // Add user message
    await this.addMessage(userId, "user", userMessage);

    // If already completed, just return current state
    if (state.status === "completed") {
      return {
        state,
        messages: await this.getMessages(userId),
        assistantResponse:
          "You're all set! Let me know if there's anything else.",
        isComplete: true,
      };
    }

    // Determine which question this answer addresses
    // Simple heuristic: look for keywords or use the current outstanding question
    const nextQuestion = this.getNextQuestion(state);

    if (nextQuestion) {
      // Update answer for current question
      await this.updateAnswer(userId, nextQuestion, userMessage);
    }

    // Get updated state
    const updatedState = await this.getState(userId);
    if (!updatedState) {
      throw new Error("Failed to get updated onboarding state");
    }

    // Check if complete
    const complete = this.isComplete(updatedState);
    let finalState = updatedState;

    if (complete) {
      finalState = await this.markCompleted(userId);

      // Add completion message
      await this.addMessage(
        userId,
        "assistant",
        "I've got everything I need. You're all set!",
      );
    } else {
      // Get next question and generate response
      const assistantResponse = this.generateAssistantResponse(
        finalState,
        userMessage,
      );

      // Add assistant message
      await this.addMessage(userId, "assistant", assistantResponse);

      return {
        state: finalState,
        messages: await this.getMessages(userId),
        assistantResponse,
        isComplete: false,
      };
    }

    return {
      state: finalState,
      messages: await this.getMessages(userId),
      assistantResponse: "I've got everything I need. You're all set!",
      isComplete: true,
    };
  }
}

export const onboardingRepository = new OnboardingRepository();
