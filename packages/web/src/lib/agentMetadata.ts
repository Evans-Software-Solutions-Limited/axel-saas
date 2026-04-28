/**
 * Static product metadata for each agent that can be shown in the office / tasks UI.
 *
 * Keys map to the `source` field on a task row (see `packages/db/src/schema.ts`).
 * This data is intentionally hardcoded on the frontend — it does not change per
 * user and doesn't need to round-trip through the API.
 */
export type AgentId = "axel" | "scribe" | "relay" | "keeper" | "ops";

export interface AgentMetadata {
  id: AgentId;
  name: string;
  role: string;
  spriteImage: string;
  avatarColour: string;
}

export const AGENT_METADATA: Record<AgentId, AgentMetadata> = {
  axel: {
    id: "axel",
    name: "Axel",
    role: "Chief Task Handler",
    spriteImage: "/sprites/sprite-axel.png",
    avatarColour: "bg-blue-600",
  },
  scribe: {
    id: "scribe",
    name: "Scribe",
    role: "Document Writer",
    spriteImage: "/sprites/sprite-scribe.png",
    avatarColour: "bg-emerald-600",
  },
  relay: {
    id: "relay",
    name: "Relay",
    role: "Comms Manager",
    spriteImage: "/sprites/sprite-relay.png",
    avatarColour: "bg-violet-600",
  },
  keeper: {
    id: "keeper",
    name: "Keeper",
    role: "Knowledge Manager",
    spriteImage: "/sprites/sprite-keeper.png",
    avatarColour: "bg-amber-600",
  },
  ops: {
    id: "ops",
    name: "Ops",
    role: "Automation Runner",
    spriteImage: "/sprites/sprite-ops.png",
    avatarColour: "bg-rose-600",
  },
};

export const KNOWN_AGENT_IDS = Object.keys(AGENT_METADATA) as AgentId[];

/**
 * Return metadata for a task source. Falls back to an "Axel" default when the
 * source isn't one of the known sub-agents so we never show "undefined".
 */
export function getAgentMetadata(
  source: string | null | undefined,
): AgentMetadata {
  if (source && source in AGENT_METADATA) {
    return AGENT_METADATA[source as AgentId];
  }
  return AGENT_METADATA.axel;
}

export function isKnownAgent(
  source: string | null | undefined,
): source is AgentId {
  return !!source && source in AGENT_METADATA;
}
