import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getStage } from "../stage";

describe("getStage", () => {
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    originals.OPENCLAW_STAGE = process.env.OPENCLAW_STAGE;
    originals.STAGE = process.env.STAGE;
    originals.SST_STAGE = process.env.SST_STAGE;
    delete process.env.OPENCLAW_STAGE;
    delete process.env.STAGE;
    delete process.env.SST_STAGE;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(originals)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("prefers OPENCLAW_STAGE over STAGE and SST_STAGE", () => {
    process.env.OPENCLAW_STAGE = "from-openclaw-stage";
    process.env.STAGE = "from-stage";
    process.env.SST_STAGE = "from-sst-stage";
    expect(getStage()).toBe("from-openclaw-stage");
  });

  it("falls back to STAGE when OPENCLAW_STAGE is unset", () => {
    process.env.STAGE = "staging";
    process.env.SST_STAGE = "ignored";
    expect(getStage()).toBe("staging");
  });

  it("falls back to SST_STAGE when STAGE is unset", () => {
    process.env.SST_STAGE = "preview-abc";
    expect(getStage()).toBe("preview-abc");
  });

  it("throws when nothing is set", () => {
    expect(() => getStage()).toThrowError(/STAGE/);
  });
});
