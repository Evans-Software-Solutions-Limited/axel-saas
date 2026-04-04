import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { userRepository } from "../repositories/userRepository";
import { ProvisioningRepository } from "../repositories/provisioningRepository";
import { SubscriptionRepository } from "../repositories/subscriptionRepository";
import { TaskRepository } from "../tasks/taskRepository";

// Create instance for use in handler
const provisioningRepo = new ProvisioningRepository();
const taskRepo = new TaskRepository();

// Types for API responses
export interface ChatMessageRequest {
  message: string;
}

export interface ChatMessageResponse {
  success: boolean;
  response: string;
  messageId?: string;
}

export interface AgentStatusResponse {
  success: boolean;
  status:
    | "active"
    | "workspace_ready"
    | "provisioning"
    | "failed"
    | "not_found"
    | "subscription_required";
  gatewayUrl?: string;
  handoffGreeting?: string;
}

/**
 * Generate a handoff greeting for when the user's dedicated Axel first becomes active.
 * Uses onboarding context so Axel doesn't re-ask what it already knows.
 */
export function generateHandoffGreeting(
  name: string | null,
  goals: string | null,
): string {
  const addressee = name ? name : "there";
  if (goals) {
    return `Hey ${addressee}! Your dedicated Axel is ready. I've read your setup and I know you're working on ${goals} — what would you like to tackle first?`;
  }
  return `Hey ${addressee}! Your dedicated Axel is set up and ready to help. What would you like to work on?`;
}

/**
 * Generate a contextual response using user's onboarding data
 * This provides a personalized response when the gateway is unavailable
 */
export function generateContextualResponse(
  userName: string | null,
  userRole: string | null,
  userGoals: string | null,
  userMessage: string,
): string {
  const name = userName || "there";
  const role = userRole || "your work";
  const goals = userGoals || "what you're focused on";

  // Simple response logic based on message content
  const lowerMessage = userMessage.toLowerCase();

  // Greeting responses - use word boundaries to avoid matching substrings.
  const greetingRegex = /\b(hello|hi|hey)\b/i;
  if (greetingRegex.test(lowerMessage)) {
    return `Hey ${name}! Good to hear from you. How's ${role} going?`;
  }

  // How can you help / what can you do
  if (
    lowerMessage.includes("what can you do") ||
    lowerMessage.includes("how can you help") ||
    lowerMessage.includes("help me")
  ) {
    return `I'm here to help you with ${goals}. I can assist with research, drafting, scheduling, and more. What do you need?`;
  }

  // Questions about the user
  if (
    lowerMessage.includes("who am i") ||
    lowerMessage.includes("what do you know about me")
  ) {
    if (userName || userRole) {
      const details = [];
      if (userName) details.push(`you're ${userName}`);
      if (userRole) details.push(`you work as ${userRole}`);
      return `From what you've told me, ${details.join(", and ")}. You're focused on ${goals}. That's what I know about you!`;
    }
    return `I'm still getting to know you! Complete onboarding and I'll remember all the details.`;
  }

  // Default contextual response
  return `Hey ${name}, thanks for reaching out! I'm here to help you with ${goals}. What would you like to work on?`;
}

/**
 * Validate gateway URL to prevent auth token leakage to untrusted endpoints.
 * Returns the validated URL or null if invalid.
 */
function validateGatewayUrl(urlString: string): string | null {
  try {
    const url = new URL(urlString);

    // Only allow HTTPS in production, allow HTTP for development
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      console.error("Gateway URL must use HTTPS in production");
      return null;
    }

    // Block private/localhost addresses in production
    if (process.env.NODE_ENV === "production") {
      const hostname = url.hostname;
      const privateRanges = [
        /^localhost$/i,
        /^127\./,
        /^192\.168\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
      ];

      if (privateRanges.some((range) => range.test(hostname))) {
        console.error("Gateway URL cannot be a private IP address");
        return null;
      }
    }

    return url.toString();
  } catch (err) {
    console.error("Invalid gateway URL:", err);
    return null;
  }
}

async function getDemoChatResponse(
  userId: string,
  message: string,
): Promise<ChatMessageResponse> {
  const onboardingAnswers = await userRepository.getOnboardingAnswers(userId);
  const userName = (onboardingAnswers?.name as string | null) || null;
  const userRole = (onboardingAnswers?.role as string | null) || null;
  const userGoals =
    (onboardingAnswers?.helpWith as string | null) ||
    (onboardingAnswers?.proactiveAreas as string | null) ||
    null;

  return {
    success: true,
    response: generateContextualResponse(
      userName,
      userRole,
      userGoals,
      message,
    ),
  };
}

export const chatHandler = new Elysia({ name: "ChatHandler" })
  .derive(async ({ headers }) => ({
    user: await getAuthUser(headers.authorization),
  }))
  .onBeforeHandle(requireAuth)
  .get(
    "/users/me/agent",
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

        // Check if onboarding is complete
        if (!dbUser.onboardingCompleted) {
          set.status = 400;
          return {
            success: false,
            error: "Onboarding not completed",
          };
        }

        // Require an active or trialing subscription before agent access
        const subRepo = new SubscriptionRepository();
        const subscription = await subRepo.findByUserId(dbUser.id);
        if (
          !subscription ||
          !["active", "trialing"].includes(subscription.status)
        ) {
          return {
            success: true,
            status: "subscription_required" as const,
          };
        }

        // Get container info
        const container = await provisioningRepo.getContainerByUserId(
          dbUser.id,
        );

        if (!container) {
          // No provisioning record exists yet.
          return {
            success: true,
            status: "not_found",
          };
        }

        if (container.status === "failed") {
          return { success: true, status: "failed" as const };
        }

        // workspace_ready: files on disk, container not yet launched
        if (container.status === "workspace_ready") {
          return { success: true, status: "workspace_ready" as const };
        }

        const isActive =
          container.status === "active" && !!container.gatewayUrl;

        if (!isActive) {
          return { success: true, status: "provisioning" as const };
        }

        // Build a personalised handoff greeting so the frontend can signal the
        // transition from setup into real chat without re-asking known context.
        // This lookup is non-essential: if it fails, return active status with
        // a generic greeting rather than degrading the endpoint to a 500.
        try {
          const onboardingAnswers = await userRepository.getOnboardingAnswers(
            dbUser.id,
          );
          // Use || (not ??) so that an empty string falls through to the next
          // field, matching the same behaviour as the demo-chat fallback chain.
          const handoffName =
            (onboardingAnswers?.name as string | null) || null;
          const handoffGoals =
            (onboardingAnswers?.helpWith as string | null) ||
            (onboardingAnswers?.proactiveAreas as string | null) ||
            null;

          return {
            success: true,
            status: "active" as const,
            handoffGreeting: generateHandoffGreeting(handoffName, handoffGoals),
          };
        } catch (greetingError) {
          console.error(
            "Failed to load onboarding answers for handoff greeting:",
            greetingError,
          );
          return {
            success: true,
            status: "active" as const,
            handoffGreeting: generateHandoffGreeting(null, null),
          };
        }
      } catch (error) {
        console.error("Get agent status error:", error);
        set.status = 500;
        return { success: false, error: "Failed to get agent status" };
      }
    },
    {
      detail: {
        description: "Get live agent connection info",
        tags: ["Chat"],
      },
    },
  )
  .post(
    "/users/chat/message",
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

        // Require onboarding to be completed
        if (!dbUser.onboardingCompleted) {
          set.status = 400;
          return {
            success: false,
            error: "Onboarding must be completed before using chat",
          };
        }

        // Require an active or trialing subscription before chat access
        const subRepo = new SubscriptionRepository();
        const subscription = await subRepo.findByUserId(dbUser.id);
        if (
          !subscription ||
          !["active", "trialing"].includes(subscription.status)
        ) {
          set.status = 402;
          return {
            success: false,
            error: "Subscription required to use chat",
          };
        }

        // Get container info
        const container = await provisioningRepo.getContainerByUserId(
          dbUser.id,
        );

        if (!container) {
          set.status = 503;
          return {
            success: false,
            error: "Agent not yet provisioned. Please try again later.",
          };
        }

        if (container.status !== "active") {
          set.status = 503;
          return {
            success: false,
            error: "Agent is not ready. Please try again later.",
          };
        }

        if (!container.gatewayUrl) {
          if (process.env.NODE_ENV !== "production") {
            return getDemoChatResponse(dbUser.id, body.message);
          }

          set.status = 503;
          return {
            success: false,
            error: "Agent is not ready. Please try again later.",
          };
        }

        // Validate gateway URL to prevent auth header leakage
        const gatewayUrl = validateGatewayUrl(container.gatewayUrl);
        if (!gatewayUrl) {
          console.error("Invalid gateway URL:", container.gatewayUrl);
          set.status = 500;
          return {
            success: false,
            error: "Gateway configuration error",
          };
        }

        // Create a task record and emit task.started before dispatching to the
        // gateway.  Errors here are non-fatal — task tracking must not block chat.
        let taskId: string | null = null;
        try {
          const task = await taskRepo.createTask({
            userId: dbUser.id,
            source: "chat",
            taskSummary: body.message.slice(0, 200),
          });
          taskId = task.id;
          await taskRepo.appendEvent({
            taskId: task.id,
            eventType: "task.started",
            source: "chat",
            payload: {},
          });
        } catch (taskStartErr) {
          console.error("Task start event failed (non-fatal):", taskStartErr);
        }

        try {
          const gatewayResponse = await fetch(`${gatewayUrl}/api/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              // Forward the authorization header for gateway auth
              Authorization: ctx.headers.authorization || "",
            },
            body: JSON.stringify({
              message: body.message,
              userId: dbUser.id,
            }),
          });

          if (!gatewayResponse.ok) {
            throw new Error(`Gateway error: ${gatewayResponse.status}`);
          }

          const gatewayData = (await gatewayResponse.json()) as {
            response?: string;
            message?: string;
            messageId?: string;
          };

          // Emit task.completed — awaited so the write completes before Lambda
          // returns; non-fatal if it fails.
          if (taskId) {
            try {
              await taskRepo.appendEvent({
                taskId,
                eventType: "task.completed",
                source: "chat",
                payload: {},
              });
            } catch (err) {
              console.error("Task completed event failed (non-fatal):", err);
            }
          }

          return {
            success: true,
            response:
              gatewayData.response || gatewayData.message || "No response",
            messageId: gatewayData.messageId,
          };
        } catch (fetchError) {
          console.error("Gateway fetch error:", fetchError);

          // Emit task.failed — awaited so the write completes before Lambda
          // returns; non-fatal if it fails.
          if (taskId) {
            try {
              await taskRepo.appendEvent({
                taskId,
                eventType: "task.failed",
                source: "chat",
                payload: {
                  error:
                    fetchError instanceof Error
                      ? fetchError.message
                      : String(fetchError),
                },
              });
            } catch (err) {
              console.error("Task failed event failed (non-fatal):", err);
            }
          }

          // For development/demo, return a contextual response using onboarding data
          if (process.env.NODE_ENV !== "production") {
            return getDemoChatResponse(dbUser.id, body.message);
          }

          set.status = 502;
          return {
            success: false,
            error: "Failed to reach agent. Please try again.",
          };
        }
      } catch (error) {
        console.error("Chat message error:", error);
        set.status = 500;
        return { success: false, error: "Failed to send chat message" };
      }
    },
    {
      body: t.Object({
        message: t.String({ minLength: 1 }),
      }),
      detail: {
        description: "Send message to live agent",
        tags: ["Chat"],
      },
    },
  );
