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
import {
  TokenUsageService,
  estimateMessageTokens,
  projectMessageOutputTokens,
} from "../usage/tokenUsageService";
import { RateLimitService } from "../rate-limiting/rateLimitService";
import type { SubscriptionTier } from "../integrations/tierGate";
import {
  applyRateLimitHeaders,
  buildRateLimitedBody,
} from "../rate-limiting/rateLimitHeaders";
import { postChat } from "../gateway/gatewayClient";
import { validateGatewayUrl } from "../gateway/gatewayUrl";

// Create instance for use in handler
const provisioningRepo = new ProvisioningRepository();
const taskRepo = new TaskRepository();
const tokenUsageService = new TokenUsageService();
const rateLimitService = new RateLimitService();

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

// Gateway URL validation, postChat, checkHealth, triggerReload all live
// in `../gateway/`. See `specs/gateway-contract/design.md`.

async function getDemoChatResponse(
  userId: string,
  message: string,
  estimatedInputTokens: number,
): Promise<ChatMessageResponse> {
  const onboardingAnswers = await userRepository.getOnboardingAnswers(userId);
  const userName = (onboardingAnswers?.name as string | null) || null;
  const userRole = (onboardingAnswers?.role as string | null) || null;
  const userGoals =
    (onboardingAnswers?.helpWith as string | null) ||
    (onboardingAnswers?.proactiveAreas as string | null) ||
    null;

  const responseText = generateContextualResponse(
    userName,
    userRole,
    userGoals,
    message,
  );

  // Record usage even in dev — the cap check already ran upstream, so
  // without this side-effect a developer can never reach the
  // cap-reached flow locally without inserting rows by hand. Mirrors
  // the gateway path's `estimateMessageTokens(responseText)` fallback
  // when the source doesn't report token counts. `model: "demo"`
  // distinguishes these rows from real gateway calls in the audit log.
  // Errors are non-fatal — a usage-record failure must not block a
  // successful chat response.
  try {
    await tokenUsageService.recordUsage({
      userId,
      inputTokens: estimatedInputTokens,
      outputTokens: estimateMessageTokens(responseText),
      model: "demo",
      source: "chat",
    });
  } catch (err) {
    console.error("Token usage record failed (non-fatal):", err);
  }

  return {
    success: true,
    response: responseText,
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

        const tier = (subscription.tier ?? null) as SubscriptionTier | null;

        // Per-user rate limit — caps request volume (Free 10/min,
        // Premium/Enterprise 30/min). Runs before the token cap and
        // gateway dispatch so a user spamming the chat endpoint stops
        // costing us DDB writes for usage records and Lambda time
        // before the burst even reaches AI inference. Token cap covers
        // total cost; rate limit covers burst frequency — they're
        // complementary.
        const rateLimit = await rateLimitService.checkAndConsume({
          userId: dbUser.id,
          category: "chat",
          tier,
        });
        applyRateLimitHeaders(ctx, rateLimit);
        if (!rateLimit.allowed) {
          set.status = 429;
          return buildRateLimitedBody(
            rateLimit,
            "Slow down — Axel needs a moment.",
          );
        }

        // Token cap check — enforced before dispatching to the gateway
        // so a user already at the cap doesn't trigger a paid model
        // call. The estimator uses the brief's `messageLength / 4`
        // placeholder for the input until the gateway returns real
        // per-call usage. The output projection multiplies the input
        // estimate (and applies a floor) because assistant responses
        // are typically several times longer than the user prompt; a
        // 1:1 projection lets a short prompt produce a long response
        // and overshoot the daily output cap before the recorded
        // usage catches up. Free tier is enforced daily, Premium
        // monthly, Enterprise unlimited.
        const estimatedInput = estimateMessageTokens(body.message);
        const estimatedOutput = projectMessageOutputTokens(estimatedInput);
        const cap = await tokenUsageService.checkCap(dbUser.id, tier, {
          inputTokens: estimatedInput,
          outputTokens: estimatedOutput,
        });
        if (!cap.allowed) {
          set.status = 429;
          return {
            success: false,
            error: cap.reason,
            scope: cap.scope,
            resetAt: cap.resetAt,
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
            return getDemoChatResponse(dbUser.id, body.message, estimatedInput);
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

        // Dispatch to the gateway through the typed client. The client
        // applies the spec-mandated 60s timeout, injects X-Request-Id
        // for tracing, validates the URL inline, and returns a
        // discriminated union — no `try/catch` around `fetch` here.
        const gatewayResult = await postChat({
          rawGatewayUrl: gatewayUrl,
          message: body.message,
          userId: dbUser.id,
          authorization: ctx.headers.authorization || undefined,
        });

        if (gatewayResult.kind === "ok") {
          // Emit task.completed — awaited so the write completes before
          // Lambda returns; non-fatal if it fails.
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

          // Record usage. Prefer gateway-reported counts when present;
          // fall back to the same `messageLength / 4` estimate the cap
          // check used. Errors here are non-fatal — failing to record
          // usage must not break a successful chat response.
          const responseText =
            gatewayResult.body.response || gatewayResult.body.message || "";
          const reportedInput =
            typeof gatewayResult.body.usage?.inputTokens === "number"
              ? gatewayResult.body.usage.inputTokens
              : estimatedInput;
          const reportedOutput =
            typeof gatewayResult.body.usage?.outputTokens === "number"
              ? gatewayResult.body.usage.outputTokens
              : estimateMessageTokens(responseText);
          try {
            await tokenUsageService.recordUsage({
              userId: dbUser.id,
              inputTokens: reportedInput,
              outputTokens: reportedOutput,
              model: gatewayResult.body.usage?.model ?? "unknown",
              source: "chat",
            });
          } catch (err) {
            console.error("Token usage record failed (non-fatal):", err);
          }

          return {
            success: true,
            response: responseText || "No response",
            messageId: gatewayResult.body.messageId,
          };
        }

        // Failure path. Emit task.failed and decide between dev demo
        // fallback vs production-grade structured error mapping.
        if (taskId) {
          try {
            await taskRepo.appendEvent({
              taskId,
              eventType: "task.failed",
              source: "chat",
              payload: {
                kind: gatewayResult.kind,
                ...(gatewayResult.kind === "error"
                  ? { status: gatewayResult.status }
                  : {}),
                ...("message" in gatewayResult && gatewayResult.message
                  ? { error: gatewayResult.message }
                  : {}),
              },
            });
          } catch (err) {
            console.error("Task failed event failed (non-fatal):", err);
          }
        }

        console.error("Gateway call failed:", gatewayResult);

        if (process.env.NODE_ENV !== "production") {
          // Dev demo fallback so local development isn't blocked by an
          // unreachable gateway.
          return getDemoChatResponse(dbUser.id, body.message, estimatedInput);
        }

        // Production: structured error mapping per spec §"Error
        // Handling & Resilience". Gateway 429 → user 429 with
        // Retry-After. Gateway 5xx → user 502. Network/timeout/invalid
        // URL → user 503 (the agent is temporarily unreachable).
        if (gatewayResult.kind === "rate_limited") {
          set.status = 429;
          // Mutate the headers bag in place — Elysia's HTTPHeaders type
          // is branded and resists spread assignment. Same pattern as
          // `applyRateLimitHeaders` in the rate-limit module.
          if (!set.headers) set.headers = {};
          (set.headers as Record<string, string>)["Retry-After"] = String(
            gatewayResult.retryAfter,
          );
          return {
            success: false,
            error:
              gatewayResult.message ??
              "Agent is processing another request. Please wait.",
          };
        }
        if (gatewayResult.kind === "error") {
          set.status = 502;
          return { success: false, error: "Agent returned an error." };
        }
        // timeout / network_error / invalid_url all collapse to 503 —
        // the user-facing distinction isn't useful, and the structured
        // logs above carry the detail for ops.
        set.status = 503;
        return {
          success: false,
          error: "Failed to reach agent. Please try again.",
        };
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
