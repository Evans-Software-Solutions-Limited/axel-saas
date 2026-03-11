import { api } from "@/lib/eden";

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
}

interface ApiErrorLike {
  status?: number;
  message?: string;
  value?: unknown;
}

export class OnboardingAlreadyCompleteError extends Error {
  constructor() {
    super("Onboarding already completed");
    this.name = "OnboardingAlreadyCompleteError";
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (value: unknown): string | undefined => {
  if (!isObject(value)) return undefined;
  const message = value["error"];
  return typeof message === "string" ? message : undefined;
};

const getStatusCode = (value: unknown): number | undefined => {
  if (!isObject(value)) return undefined;

  const topLevelStatus = value["status"];
  if (typeof topLevelStatus === "number") return topLevelStatus;

  const nestedError = value["error"];
  if (isObject(nestedError) && typeof nestedError["status"] === "number") {
    return nestedError["status"];
  }

  return undefined;
};

const getResponseError = (value: unknown): ApiErrorLike | undefined => {
  if (!isObject(value)) return undefined;
  const errorValue = value["error"];
  return isObject(errorValue) ? (errorValue as ApiErrorLike) : undefined;
};

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
      "isComplete" in data
    ) {
      const successData = data as PostMessageSuccessPayload;
      return {
        state: successData.state,
        messages: successData.messages,
        assistantResponse: successData.assistantResponse,
        isComplete: successData.isComplete,
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
