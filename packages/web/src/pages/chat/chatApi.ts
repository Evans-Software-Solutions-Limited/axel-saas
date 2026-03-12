import { api } from "@/lib/eden";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AgentStatus {
  success: boolean;
  status: "active" | "provisioning" | "not_found";
  gatewayUrl?: string;
}

export interface ChatMessageResult {
  success: boolean;
  response: string;
  messageId?: string;
}

interface ChatMessageSuccessPayload {
  success: true;
  response: string;
  messageId?: string;
}

interface AgentStatusSuccessPayload {
  success: true;
  status: "active" | "provisioning" | "not_found";
  gatewayUrl?: string;
}

interface ApiErrorLike {
  status?: number;
  message?: string;
  value?: unknown;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getErrorMessage = (value: unknown): string | undefined => {
  if (!isObject(value)) return undefined;
  const message = value["error"];
  return typeof message === "string" ? message : undefined;
};

const getResponseError = (value: unknown): ApiErrorLike | undefined => {
  if (!isObject(value)) return undefined;
  const errorValue = value["error"];
  return isObject(errorValue) ? (errorValue as ApiErrorLike) : undefined;
};

/**
 * Get the live agent's connection status
 */
export async function getAgentStatus(): Promise<AgentStatus> {
  const response = await api.core.users["me"].agent.get();
  const data = response.data;

  if (data?.success === true && "status" in data) {
    return data as AgentStatusSuccessPayload;
  }

  const errorMessage =
    getResponseError(response)?.message ??
    getErrorMessage(getResponseError(response)?.value) ??
    "Failed to get agent status";

  throw new Error(errorMessage);
}

/**
 * Send a message to the live agent
 */
export async function postChatMessage(
  message: string,
): Promise<ChatMessageResult> {
  const response = await api.core.users.chat.message.post({ message });
  const data = response.data;

  if (data?.success === true && "response" in data) {
    return data as ChatMessageSuccessPayload;
  }

  const responseError = getResponseError(response);
  const errorMessage =
    responseError?.message ??
    getErrorMessage(responseError?.value) ??
    "Failed to send chat message";

  throw new Error(errorMessage);
}
