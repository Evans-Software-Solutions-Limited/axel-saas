import { describe, it, expect } from "vitest";
import {
  AGENT_METADATA,
  KNOWN_AGENT_IDS,
  getAgentMetadata,
  isKnownAgent,
} from "../agentMetadata";

describe("agentMetadata", () => {
  it("exposes all five agents", () => {
    expect(KNOWN_AGENT_IDS).toEqual([
      "axel",
      "scribe",
      "relay",
      "keeper",
      "ops",
    ]);
    for (const id of KNOWN_AGENT_IDS) {
      const meta = AGENT_METADATA[id];
      expect(meta.name).toBeTruthy();
      expect(meta.role).toBeTruthy();
      expect(meta.spriteImage).toMatch(/sprite-/);
      expect(meta.avatarColour).toMatch(/^bg-/);
    }
  });

  it("returns metadata for a known source", () => {
    expect(getAgentMetadata("scribe").name).toBe("Scribe");
  });

  it("falls back to Axel for unknown / null / undefined source", () => {
    expect(getAgentMetadata("mystery").name).toBe("Axel");
    expect(getAgentMetadata(null).name).toBe("Axel");
    expect(getAgentMetadata(undefined).name).toBe("Axel");
  });

  it("isKnownAgent narrows correctly", () => {
    expect(isKnownAgent("axel")).toBe(true);
    expect(isKnownAgent("mystery")).toBe(false);
    expect(isKnownAgent(null)).toBe(false);
    expect(isKnownAgent(undefined)).toBe(false);
  });
});
