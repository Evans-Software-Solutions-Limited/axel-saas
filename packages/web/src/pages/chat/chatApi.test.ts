import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatCapReachedMessage,
  getAgentStatus,
  postChatMessage,
  TokenCapReachedError,
} from "./chatApi";

const { api: mockApi } = vi.hoisted(() => ({
  api: {
    core: {
      users: {
        me: {
          agent: {
            get: vi.fn(),
          },
        },
        chat: {
          message: {
            post: vi.fn(),
          },
        },
      },
    },
  },
}));

vi.mock("@/lib/eden", () => ({
  api: mockApi,
}));

describe("chatApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAgentStatus", () => {
    it("returns agent status when API returns success", async () => {
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: {
          success: true,
          status: "active",
        },
      } as never);

      const result = await getAgentStatus();

      expect(result).toEqual({
        success: true,
        status: "active",
      });
    });

    it("returns agent status as provisioning", async () => {
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: {
          success: true,
          status: "provisioning",
        },
      } as never);

      const result = await getAgentStatus();

      expect(result).toEqual({
        success: true,
        status: "provisioning",
      });
    });

    it("returns agent status as not_found", async () => {
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: {
          success: true,
          status: "not_found",
        },
      } as never);

      const result = await getAgentStatus();

      expect(result).toEqual({
        success: true,
        status: "not_found",
      });
    });

    it("throws error when API returns failure with response error message", async () => {
      // Eden error structure: error at top level, not inside data
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: undefined,
        error: {
          message: "Agent not available",
        },
      } as never);

      await expect(getAgentStatus()).rejects.toThrow("Agent not available");
    });

    it("throws error when API returns failure with nested error value", async () => {
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: undefined,
        error: {
          value: { error: "Nested error message" },
        },
      } as never);

      await expect(getAgentStatus()).rejects.toThrow("Nested error message");
    });

    it("throws default error when API returns failure without message", async () => {
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: undefined,
      } as never);

      await expect(getAgentStatus()).rejects.toThrow(
        "Failed to get agent status",
      );
    });

    it("throws error when API throws exception", async () => {
      mockApi.core.users.me.agent.get.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(getAgentStatus()).rejects.toThrow("Network error");
    });

    it("throws error when API returns non-object data", async () => {
      mockApi.core.users.me.agent.get.mockResolvedValue({
        data: "not an object",
      } as never);

      await expect(getAgentStatus()).rejects.toThrow(
        "Failed to get agent status",
      );
    });
  });

  describe("postChatMessage", () => {
    it("returns chat message result when API returns success", async () => {
      mockApi.core.users.chat.message.post.mockResolvedValue({
        data: {
          success: true,
          response: "Hello! How can I help?",
          messageId: "msg-123",
        },
      } as never);

      const result = await postChatMessage("Hi there");

      expect(result).toEqual({
        success: true,
        response: "Hello! How can I help?",
        messageId: "msg-123",
      });
    });

    it("returns chat message result without messageId", async () => {
      mockApi.core.users.chat.message.post.mockResolvedValue({
        data: {
          success: true,
          response: "Hello!",
        },
      } as never);

      const result = await postChatMessage("Hi");

      expect(result).toEqual({
        success: true,
        response: "Hello!",
      });
    });

    it("throws error when API returns failure with response error message", async () => {
      mockApi.core.users.chat.message.post.mockResolvedValue({
        data: undefined,
        error: {
          message: "Rate limit exceeded",
        },
      } as never);

      await expect(postChatMessage("Hello")).rejects.toThrow(
        "Rate limit exceeded",
      );
    });

    it("throws error when API returns failure with nested error value", async () => {
      mockApi.core.users.chat.message.post.mockResolvedValue({
        data: undefined,
        error: {
          value: { error: "Validation failed" },
        },
      } as never);

      await expect(postChatMessage("Hello")).rejects.toThrow(
        "Validation failed",
      );
    });

    it("throws default error when API returns failure without message", async () => {
      mockApi.core.users.chat.message.post.mockResolvedValue({
        data: undefined,
      } as never);

      await expect(postChatMessage("Hello")).rejects.toThrow(
        "Failed to send chat message",
      );
    });

    it("throws error when API throws exception", async () => {
      mockApi.core.users.chat.message.post.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(postChatMessage("Hello")).rejects.toThrow("Network error");
    });

    it("throws error when API returns non-object data", async () => {
      mockApi.core.users.chat.message.post.mockResolvedValue({
        data: "not an object",
      } as never);

      await expect(postChatMessage("Hello")).rejects.toThrow(
        "Failed to send chat message",
      );
    });

    describe("TokenCapReachedError on 429", () => {
      it("throws TokenCapReachedError with daily scope + resetAt", async () => {
        mockApi.core.users.chat.message.post.mockResolvedValue({
          data: null,
          error: {
            status: 429,
            value: {
              error: "Daily token limit reached",
              scope: "daily",
              resetAt: "2026-05-04T00:00:00.000Z",
            },
          },
        } as never);

        await expect(postChatMessage("Hello")).rejects.toBeInstanceOf(
          TokenCapReachedError,
        );
        try {
          await postChatMessage("Hello");
        } catch (err) {
          expect(err).toBeInstanceOf(TokenCapReachedError);
          if (err instanceof TokenCapReachedError) {
            expect(err.scope).toBe("daily");
            expect(err.resetAt).toBe("2026-05-04T00:00:00.000Z");
            expect(err.message).toContain("Daily token limit reached");
          }
        }
      });

      it("preserves monthly scope", async () => {
        mockApi.core.users.chat.message.post.mockResolvedValue({
          data: null,
          error: {
            status: 429,
            value: {
              scope: "monthly",
              resetAt: "2026-06-01T00:00:00.000Z",
            },
          },
        } as never);

        try {
          await postChatMessage("Hello");
        } catch (err) {
          expect(err).toBeInstanceOf(TokenCapReachedError);
          if (err instanceof TokenCapReachedError) {
            expect(err.scope).toBe("monthly");
          }
        }
      });

      it("defaults to daily scope when the body is missing", async () => {
        mockApi.core.users.chat.message.post.mockResolvedValue({
          data: null,
          error: { status: 429, value: null },
        } as never);

        try {
          await postChatMessage("Hello");
        } catch (err) {
          expect(err).toBeInstanceOf(TokenCapReachedError);
          if (err instanceof TokenCapReachedError) {
            expect(err.scope).toBe("daily");
            expect(err.resetAt).toBe("");
          }
        }
      });
    });
  });

  describe("formatCapReachedMessage", () => {
    it("includes the reset time and an upgrade nudge for daily caps", () => {
      const err = new TokenCapReachedError(
        "daily",
        "2026-05-04T00:00:00.000Z",
        "Daily token limit reached",
      );
      const msg = formatCapReachedMessage(err);
      expect(msg).toContain("Daily token limit reached");
      expect(msg).toContain("Resets");
      expect(msg).toContain("Upgrade to Premium");
    });

    it("omits the upgrade nudge for monthly caps (Premium users)", () => {
      const err = new TokenCapReachedError(
        "monthly",
        "2026-06-01T00:00:00.000Z",
        "Monthly token limit reached",
      );
      const msg = formatCapReachedMessage(err);
      expect(msg).toContain("Monthly token limit reached");
      expect(msg).not.toContain("Upgrade to Premium");
    });

    it("falls back to a default base when message is missing", () => {
      const err = new TokenCapReachedError("daily", "");
      // Default constructor message is `Token cap reached (daily)`.
      const msg = formatCapReachedMessage(err);
      expect(msg.toLowerCase()).toContain("token cap reached");
      // No resetAt — no Resets clause.
      expect(msg).not.toContain("Resets");
    });

    it("ignores an unparseable resetAt", () => {
      const err = new TokenCapReachedError(
        "daily",
        "not-a-date",
        "Daily token limit reached",
      );
      const msg = formatCapReachedMessage(err);
      expect(msg).not.toContain("Resets");
    });
  });
});
