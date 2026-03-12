import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { userRepository } from "../repositories/userRepository";
import {
  onboardingRepository,
  QUESTION_PROMPTS,
  type QuestionKey,
} from "./onboardingRepository";

// Types for API responses
export interface OnboardingStateResponse {
  id: string;
  status: "not_started" | "in_progress" | "completed";
  outstandingQuestions: string[];
  collectedAnswers: Record<string, string>;
  completedAt: string | null;
  lastMessageAt: string | null;
}

export interface OnboardingMessageResponse {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface GetOnboardingStateResponse {
  success: boolean;
  state: OnboardingStateResponse | null;
  messages: OnboardingMessageResponse[];
  nextQuestion: string | null;
}

export interface OnboardingMessageRequest {
  message: string;
}

export interface PostOnboardingMessageResponse {
  success: boolean;
  state: OnboardingStateResponse;
  messages: OnboardingMessageResponse[];
  assistantResponse: string;
  isComplete: boolean;
}

export const onboardingHandler = new Elysia({ name: "OnboardingHandler" })
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/users/onboarding/state",
    async (ctx) => {
      const { set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        // If onboarding already completed, return simple response
        if (dbUser.onboardingCompleted) {
          const state = await onboardingRepository.getOrCreateState(dbUser.id);
          return {
            success: true,
            state: {
              id: state.id,
              status: "completed" as const,
              outstandingQuestions: [],
              collectedAnswers: {},
              completedAt: dbUser.updatedAt.toISOString(),
              lastMessageAt: null,
            },
            messages: [],
            nextQuestion: null,
          };
        }

        const { state, messages: existingMessages } =
          await onboardingRepository.getStateWithMessages(dbUser.id);

        if (!state) {
          // Create initial state if doesn't exist
          const newState = await onboardingRepository.getOrCreateState(
            dbUser.id,
          );
          const messages = await onboardingRepository.ensureTranscript(
            dbUser.id,
            newState,
          );
          const nextQuestion = onboardingRepository.getNextQuestion(newState);

          return {
            success: true,
            state: {
              id: newState.id,
              status: newState.status,
              outstandingQuestions: newState.outstandingQuestions,
              collectedAnswers: newState.collectedAnswers,
              completedAt: null,
              lastMessageAt: newState.lastMessageAt?.toISOString() ?? null,
            },
            messages: messages.map((m) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            })),
            nextQuestion: nextQuestion
              ? QUESTION_PROMPTS[nextQuestion as QuestionKey]
              : null,
          };
        }

        // Use existing messages from getStateWithMessages; only call ensureTranscript
        // if we have no messages yet (to add the initial assistant prompt).
        const messages =
          existingMessages.length > 0
            ? existingMessages
            : await onboardingRepository.ensureTranscript(dbUser.id, state);
        const nextQuestion = onboardingRepository.getNextQuestion(state);

        return {
          success: true,
          state: {
            id: state.id,
            status: state.status,
            outstandingQuestions: state.outstandingQuestions,
            collectedAnswers: state.collectedAnswers,
            completedAt: state.completedAt?.toISOString() ?? null,
            lastMessageAt: state.lastMessageAt?.toISOString() ?? null,
          },
          messages: messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          nextQuestion: nextQuestion
            ? QUESTION_PROMPTS[nextQuestion as QuestionKey]
            : null,
        };
      } catch (error) {
        console.error("Get onboarding state error:", error);
        set.status = 500;
        return { success: false, error: "Failed to fetch onboarding state" };
      }
    },
    {
      detail: {
        description: "Get current onboarding state",
        tags: ["Onboarding"],
      },
    },
  )
  .post(
    "/users/onboarding/message",
    async (ctx) => {
      const { body, set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        // If already completed, return 409 Conflict - cannot add more messages
        if (dbUser.onboardingCompleted) {
          set.status = 409;
          return {
            success: false,
            error: "Onboarding already completed for this user",
          };
        }

        const result = await onboardingRepository.processMessage(
          dbUser.id,
          body.message,
        );

        return {
          success: true,
          state: {
            id: result.state.id,
            status: result.state.status,
            outstandingQuestions: result.state.outstandingQuestions,
            collectedAnswers: result.state.collectedAnswers,
            completedAt: result.state.completedAt?.toISOString() ?? null,
            lastMessageAt: result.state.lastMessageAt?.toISOString() ?? null,
          },
          messages: result.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
          assistantResponse: result.assistantResponse,
          isComplete: result.isComplete,
        };
      } catch (error) {
        console.error("Onboarding message error:", error);
        set.status = 500;
        return {
          success: false,
          error: "Failed to process onboarding message",
        };
      }
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "Submit onboarding message",
        tags: ["Onboarding"],
      },
    },
  )
  .post(
    "/users/onboarding/start",
    async (ctx) => {
      const { set } = ctx;
      try {
        const dbUser = await userRepository.getUserBySupabaseId(
          getUser(ctx).sub,
        );
        if (!dbUser) {
          set.status = 404;
          return { success: false, error: "User not found" };
        }

        // If already completed, return success
        if (dbUser.onboardingCompleted) {
          return { success: true, message: "Onboarding already completed" };
        }

        // Get or create state
        const state = await onboardingRepository.getOrCreateState(dbUser.id);

        // If already started, return current state
        if (state.status !== "not_started") {
          const nextQuestion = onboardingRepository.getNextQuestion(state);
          return {
            success: true,
            message: "Onboarding already in progress",
            nextQuestion: nextQuestion
              ? QUESTION_PROMPTS[nextQuestion as QuestionKey]
              : null,
          };
        }

        // Start onboarding - add initial message
        const initialMessage =
          "Hey there! I've just been set up for you. Before I can be useful, I need to get to know you a bit. What should I call you?";

        await onboardingRepository.addMessage(
          dbUser.id,
          "assistant",
          initialMessage,
        );

        return {
          success: true,
          message: "Onboarding started",
          nextQuestion: QUESTION_PROMPTS.name,
        };
      } catch (error) {
        console.error("Start onboarding error:", error);
        set.status = 500;
        return { success: false, error: "Failed to start onboarding" };
      }
    },
    {
      detail: {
        description: "Start onboarding conversation",
        tags: ["Onboarding"],
      },
    },
  );
