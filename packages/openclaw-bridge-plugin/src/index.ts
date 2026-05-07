/**
 * Plugin entry — registers the four gateway-contract HTTP routes
 * (`/api/chat`, `/api/health`, `/api/reload`, `/api/usage`) on the
 * OpenClaw gateway via the documented `api.registerHttpRoute(...)`
 * surface.
 *
 * All routes use `auth: "gateway"` so OpenClaw's own gateway-token
 * authentication enforces the bearer check before the handler runs.
 * The matching backend client (PR #98's `gatewayClient.ts`) sends
 * `Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>` already.
 *
 * `match: "exact"` on every route — we want `/api/chat` to be
 * `/api/chat` literally, not a prefix match that would catch e.g.
 * `/api/chat-archive`.
 *
 * Plugin config (see `openclaw.plugin.json`):
 *   - `chatCompletionsBaseUrl`: where the chat handler reaches
 *     OpenClaw's first-party `/v1/chat/completions`. Defaults to
 *     `http://127.0.0.1:18789` because the plugin runs in the same
 *     process as the gateway.
 *   - `defaultModel`: model id passed to `/v1/chat/completions` when
 *     the request doesn't specify one. Defaults to `anthropic/haiku`
 *     to match the free-tier workspace template.
 *
 * Architecture rationale and option comparison live in the PR
 * description. TL;DR: this plugin is in-process inside the OpenClaw
 * gateway, replacing the pre-spike "external sidecar over WS" idea —
 * smaller surface, documented extension point, no reverse-engineered
 * private wire format.
 */
import {
  definePluginEntry,
  emptyPluginConfigSchema,
} from "openclaw/plugin-sdk/plugin-entry";
import { makeChatRouteHandler } from "./handlers/chatRoute";
import { makeHealthRouteHandler } from "./handlers/healthRoute";
import { makeReloadRouteHandler } from "./handlers/reloadRoute";
import { makeUsageRouteHandler } from "./handlers/usageRoute";

const DEFAULT_CHAT_COMPLETIONS_BASE_URL = "http://127.0.0.1:18789";
// OpenClaw's `/v1/chat/completions` endpoint only accepts the routing
// keys `openclaw` and `openclaw/<agentId>`. The agent's actual model
// (anthropic/haiku, anthropic/sonnet, …) is configured on the agent
// side via `agents.defaults.model.primary` in the workspace template
// — the API caller doesn't get to override it. Using `openclaw` as
// the default routes to whatever the active workspace agent has.
const DEFAULT_MODEL = "openclaw";

interface PluginConfig {
  chatCompletionsBaseUrl?: string;
  defaultModel?: string;
}

export default definePluginEntry({
  id: "axel-bridge",
  name: "Axel Gateway Bridge",
  description:
    "Exposes Axel's gateway-contract REST surface (POST /api/chat, GET /api/health, POST /api/reload, GET /api/usage) inside the OpenClaw gateway, translating to /v1/chat/completions for chat.",
  // Schema validation is deliberately permissive (no Zod dependency).
  // Both fields are optional with safe `??` defaults read in `register`,
  // so the plugin tolerates absent / wrong-typed config without crashing
  // OpenClaw at boot. The authoritative schema (for ops / docs) lives in
  // `openclaw.plugin.json`.
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    const pluginConfig = (api.pluginConfig ?? {}) as PluginConfig;
    const chatCompletionsBaseUrl =
      pluginConfig.chatCompletionsBaseUrl ?? DEFAULT_CHAT_COMPLETIONS_BASE_URL;
    const defaultModel = pluginConfig.defaultModel ?? DEFAULT_MODEL;

    api.registerHttpRoute({
      path: "/api/chat",
      auth: "gateway",
      match: "exact",
      handler: makeChatRouteHandler({
        chatCompletionsBaseUrl,
        defaultModel,
      }),
    });

    api.registerHttpRoute({
      path: "/api/health",
      auth: "gateway",
      match: "exact",
      handler: makeHealthRouteHandler({ chatCompletionsBaseUrl }),
    });

    api.registerHttpRoute({
      path: "/api/reload",
      auth: "gateway",
      match: "exact",
      handler: makeReloadRouteHandler(),
    });

    api.registerHttpRoute({
      path: "/api/usage",
      auth: "gateway",
      match: "exact",
      handler: makeUsageRouteHandler({ defaultModel }),
    });
  },
});
