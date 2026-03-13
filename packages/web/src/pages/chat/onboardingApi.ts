import { api } from "@/lib/eden";
import { getErrorMessage, getResponseError, getStatusCode } from "./apiHelpers";

export interface OnboardingState {
  id: string;
  status: "not_started" | "in_progress" | "completed";
  outstandingQuestions: string[];
  collectedAnswers: Record<string, string>;
  completedAt: string | null;
  lastMessageAt: string | null;
}

export interface OnboardingMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface GetOnboardingStateResult {
  state: OnboardingState | null;
  messages: OnboardingMessage[];
  nextQuestion: string | null;
}

export interface PostOnboardingMessageResult {
  state: OnboardingState;
  messages: OnboardingMessage[];
  assistantResponse: string;
  isComplete: boolean;
  nextQuestion: string | null;
}

interface GetStateSuccessPayload {
  success: true;
  state: OnboardingState | null;
  messages: OnboardingMessage[];
  nextQuestion: string | null;
}

interface PostMessageSuccessPayload {
  success: true;
  state: OnboardingState;
  messages: OnboardingMessage[];
  assistantResponse: string;
  isComplete: boolean;
  nextQuestion: string | null;
}

interface CompleteOnboardingSuccessPayload {
  success: true;
  message: string;
}

export class OnboardingAlreadyCompleteError extends Error {
  constructor() {
    super("Onboarding already completed");
    this.name = "OnboardingAlreadyCompleteError";
  }
}

export async function getOnboardingState(): Promise<GetOnboardingStateResult> {
  const response = await api.core.users.onboarding.state.get();
  const data = response.data;

  if (
    data?.success === true &&
    "messages" in data &&
    "nextQuestion" in data &&
    "state" in data
  ) {
    const successData = data as GetStateSuccessPayload;
    return {
      state: successData.state,
      messages: successData.messages,
      nextQuestion: successData.nextQuestion,
    };
  }

  const errorMessage =
    getResponseError(response)?.message ??
    getErrorMessage(getResponseError(response)?.value) ??
    "Failed to fetch onboarding state";

  throw new Error(errorMessage);
}

export async function postOnboardingMessage(
  message: string,
): Promise<PostOnboardingMessageResult> {
  try {
    const response = await api.core.users.onboarding.message.post({ message });
    const data = response.data;

    if (
      data?.success === true &&
      "state" in data &&
      "messages" in data &&
      "assistantResponse" in data &&
      "isComplete" in data &&
      "nextQuestion" in data
    ) {
      const successData = data as PostMessageSuccessPayload;
      return {
        state: successData.state,
        messages: successData.messages,
        assistantResponse: successData.assistantResponse,
        isComplete: successData.isComplete,
        nextQuestion: successData.nextQuestion,
      };
    }

    const responseError = getResponseError(response);
    if (responseError?.status === 409) {
      throw new OnboardingAlreadyCompleteError();
    }

    const errorMessage =
      responseError?.message ??
      getErrorMessage(responseError?.value) ??
      "Failed to send onboarding message";
    throw new Error(errorMessage);
  } catch (error) {
    const statusCode = getStatusCode(error);
    if (statusCode === 409) {
      throw new OnboardingAlreadyCompleteError();
    }

    throw error;
  }
}

export interface CompleteOnboardingResult {
  success: boolean;
  message: string;
}

export async function completeOnboarding(): Promise<CompleteOnboardingResult> {
  const response = await api.core.users["onboarding"].complete.post();
  const data = response.data;

  if (data?.success === true && "message" in data) {
    return data as CompleteOnboardingSuccessPayload;
  }

  const responseError = getResponseError(response);
  const errorMessage =
    responseError?.message ??
    getErrorMessage(responseError?.value) ??
    "Failed to complete onboarding";

  throw new Error(errorMessage);
}
