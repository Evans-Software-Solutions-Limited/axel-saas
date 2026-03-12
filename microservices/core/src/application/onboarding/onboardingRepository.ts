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
// Ordered for conversational flow: name → context → day-to-day → integrated discovery → support → logistics
// Anchor: typicalDay (concrete job discovery)
// Consolidated: helpWith now covers both immediate needs and repetitive/drain tasks
// Consolidated: briefing now combines setup + timing preference
export const ALL_QUESTIONS = [
  "name",
  "role",
  "typicalDay",
  "helpWith",
  "proactiveAreas",
  "tonePreference",
  "channels",
  "briefing",
] as const;

export type QuestionKey = (typeof ALL_QUESTIONS)[number];

// Question prompts - what the assistant asks
// These are designed to surface: what kind of work they do, what they need help with,
// what good support looks like, and where they need proactive monitoring.
// Goal: help Axel infer the job, then understand how to proactively help day-to-day.
export const QUESTION_PROMPTS: Record<QuestionKey, string> = {
  name: "Before I can be useful, what should I call you?",
  role: "Tell me a bit about you — what's your world like? What do you do, and what matters to you in your work?",
  typicalDay:
    "Walk me through a typical week. What kind of work takes up most of your time? (e.g. coding, emails, documentation, Jira work, meetings, reporting, etc.)",
  helpWith:
    "What brought you here? What would you like me to help with — things you want off your plate, recurring tasks that drain your time, or areas where you'd like a second brain?",
  proactiveAreas:
    "Are there areas where you need someone watching your back? Things like deadlines, monthly reporting, follow-ups, or things that could slip through the cracks?",
  tonePreference:
    "What does good support look like for you? Do you prefer someone who's direct and casual, or more formal and structured?",
  channels:
    "I can reach you via Slack, email, or direct messages. How do you prefer to stay connected?",
  briefing:
    "Many people find a daily briefing useful — practical stuff to kick off your day with. Would that be helpful? (We can set it up for mornings, or as a weekly digest later.)",
};

// Questions that require multiple values (arrays)
export const ARRAY_QUESTIONS: QuestionKey[] = ["helpWith", "channels"];

export type OnboardingStateWithMessages = {
  state: OnboardingState | null;
  messages: OnboardingMessage[];
};

// Initial outstanding questions for new users
function getInitialOutstandingQuestions(): QuestionKey[] {
  // Return in conversational order: name → context → day-to-day (anchor) → integrated discovery → support → logistics
  // Required: name, helpWith, channels
  // Consolidated: painPoints merged into helpWith, morningBrief/briefTime merged into briefing
  return [
    "name",
    "role",
    "typicalDay",
    "helpWith",
    "proactiveAreas",
    "tonePreference",
    "channels",
    "briefing",
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
    const [created] = await this.db
      .insert(onboardingState)
      .values({
        userId,
        status: "not_started",
        outstandingQuestions: getInitialOutstandingQuestions(),
        collectedAnswers: {},
        requiredFieldsCompleted: {
          name: false,
          helpWith: false,
          channels: false,
        },
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create onboarding state — no row returned");
    }
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
   * Ensure the transcript has a persisted assistant prompt.
   * This prevents the frontend from relying on synthetic messages that vanish
   * on the next server round-trip.
   */
  async ensureTranscript(
    userId: string,
    state: OnboardingState,
  ): Promise<OnboardingMessage[]> {
    const messages = await this.getMessages(userId);
    if (messages.length > 0 || state.status === "completed") {
      return messages;
    }

    await this.addMessage(
      userId,
      "assistant",
      this.generateAssistantResponse(state, ""),
    );

    return this.getMessages(userId);
  }

  /**
   * Add a message to the onboarding conversation
   */
  async addMessage(
    userId: string,
    role: "user" | "assistant",
    content: string,
  ): Promise<OnboardingMessage> {
    const [message] = await this.db
      .insert(onboardingMessages)
      .values({
        userId,
        role,
        content,
      })
      .returning();

    // Update lastMessageAt on state
    await this.db
      .update(onboardingState)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(onboardingState.userId, userId));

    if (!message) {
      throw new Error("Failed to insert onboarding message — no row returned");
    }
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
   * @throws Error if onboarding is already completed
   */
  async processMessage(
    userId: string,
    userMessage: string,
  ): Promise<{
    state: OnboardingState;
    messages: OnboardingMessage[];
    assistantResponse: string;
    isComplete: boolean;
    nextQuestion: string | null;
  }> {
    // Get or create state
    const state = await this.getOrCreateState(userId);

    // Reject if onboarding is already completed
    if (state.status === "completed") {
      throw new Error(
        "Onboarding already completed for this user. No further messages can be added.",
      );
    }

    // Add user message
    await this.addMessage(userId, "user", userMessage);

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

      // Get the next question for the response
      const nextQ = this.getNextQuestion(finalState);
      const nextQuestion = nextQ ? QUESTION_PROMPTS[nextQ] : null;

      return {
        state: finalState,
        messages: await this.getMessages(userId),
        assistantResponse,
        isComplete: false,
        nextQuestion,
      };
    }

    return {
      state: finalState,
      messages: await this.getMessages(userId),
      assistantResponse: "I've got everything I need. You're all set!",
      isComplete: true,
      nextQuestion: null,
    };
  }
}

export const onboardingRepository = new OnboardingRepository();
