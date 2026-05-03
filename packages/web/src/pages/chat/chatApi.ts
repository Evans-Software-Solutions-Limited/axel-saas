import { api } from "@/lib/eden";
import { getErrorMessage, getResponseError, getStatusCode } from "./apiHelpers";

export class SubscriptionRequiredError extends Error {
  constructor() {
    super("subscription_required");
    this.name = "SubscriptionRequiredError";
  }
}

/**
 * Thrown when the chat endpoint returns 429 (token cap reached). Carries
 * the cap scope ("daily" | "monthly") and the ISO timestamp at which the
 * cap resets so the UI can render an inline "you've hit your limit"
 * message rather than a generic transport error.
 */
export class TokenCapReachedError extends Error {
  readonly scope: "daily" | "monthly";
  readonly resetAt: string;

  constructor(scope: "daily" | "monthly", resetAt: string, message?: string) {
    super(message ?? `Token cap reached (${scope})`);
    this.name = "TokenCapReachedError";
    this.scope = scope;
    this.resetAt = resetAt;
  }
}

/**
 * Format a `TokenCapReachedError` into a one-line banner string. The
 * backend already returns a friendly reason ("Daily token limit
 * reached"); this helper appends a localised reset time and an upgrade
 * nudge for the daily (Free) case.
 */
export function formatCapReachedMessage(err: TokenCapReachedError): string {
  const base = err.message || "Token limit reached";
  let resetAt: string | null = null;
  if (err.resetAt) {
    const d = new Date(err.resetAt);
    if (!Number.isNaN(d.getTime())) {
      resetAt = d.toLocaleString();
    }
  }
  const upgradeNudge =
    err.scope === "daily" ? " Upgrade to Premium for ~40× the capacity." : "";
  if (resetAt) {
    return `${base}. Resets ${resetAt}.${upgradeNudge}`;
  }
  return `${base}.${upgradeNudge}`;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface AgentStatus {
  success: boolean;
  status:
    | "active"
    | "provisioning"
    | "failed"
    | "not_found"
    | "subscription_required";
  handoffGreeting?: string;
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
  status:
    | "active"
    | "provisioning"
    | "failed"
    | "not_found"
    | "subscription_required";
  handoffGreeting?: string;
}

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

  if (getStatusCode(response) === 402) {
    throw new SubscriptionRequiredError();
  }

  // 429 = token cap reached. Backend includes scope + resetAt in the
  // body so the UI can render an inline cap-reached banner with the
  // right copy.
  if (getStatusCode(response) === 429) {
    const value = getResponseError(response)?.value as
      | { scope?: "daily" | "monthly"; resetAt?: string; error?: string }
      | undefined;
    throw new TokenCapReachedError(
      value?.scope === "monthly" ? "monthly" : "daily",
      typeof value?.resetAt === "string" ? value.resetAt : "",
      typeof value?.error === "string" ? value.error : undefined,
    );
  }

  const responseError = getResponseError(response);
  const errorMessage =
    responseError?.message ??
    getErrorMessage(responseError?.value) ??
    "Failed to send chat message";

  throw new Error(errorMessage);
}
