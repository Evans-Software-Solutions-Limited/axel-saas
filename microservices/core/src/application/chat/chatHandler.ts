import Elysia, { t } from "elysia";
import {
  getAuthUser,
  requireAuth,
  getUser,
} from "@axel-saas/api-utils/auth/supabaseAuth";
import { userRepository } from "../repositories/userRepository";
import { ProvisioningRepository } from "../repositories/provisioningRepository";

// Create instance for use in handler
const provisioningRepo = new ProvisioningRepository();

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
  status: "active" | "provisioning" | "not_found";
  gatewayUrl?: string;
}

function getDemoChatResponse(message: string): ChatMessageResponse {
  return {
    success: true,
    response: `Demo response: I received your message "${message}". The gateway is not configured yet.`,
  };
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

        return {
          success: true,
          status:
            container.status === "active" && container.gatewayUrl
              ? "active"
              : "provisioning",
        };
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
            return getDemoChatResponse(body.message);
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

          return {
            success: true,
            response:
              gatewayData.response || gatewayData.message || "No response",
            messageId: gatewayData.messageId,
          };
        } catch (fetchError) {
          console.error("Gateway fetch error:", fetchError);
          // For development/demo, return a mock response if gateway is not available
          if (process.env.NODE_ENV !== "production") {
            return getDemoChatResponse(body.message);
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
