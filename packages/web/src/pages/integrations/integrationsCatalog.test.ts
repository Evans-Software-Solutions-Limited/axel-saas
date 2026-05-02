import { describe, it, expect } from "vitest";
import {
  CATEGORY_ORDER,
  INTEGRATIONS_CATALOG,
  getCatalogEntry,
} from "./integrationsCatalog";

describe("INTEGRATIONS_CATALOG", () => {
  it("covers every backend-supported integration ID", () => {
    // Mirror of microservices/core/.../integrationService.ts VALID_INTEGRATIONS.
    // Drift here is silent failure — the page would render an entry that
    // the backend immediately rejects on connect.
    const expected = [
      "openai",
      "anthropic",
      "elevenlabs",
      "telegram-bot",
      "google",
      "slack",
      "github",
    ];
    const ids = INTEGRATIONS_CATALOG.map((entry) => entry.id);
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it("only places BYOM entries (openai/anthropic) under Premium", () => {
    const byomEntries = INTEGRATIONS_CATALOG.filter(
      (e) => e.tierRequired === "premium",
    ).map((e) => e.id);
    expect(byomEntries.sort()).toEqual(["anthropic", "openai"]);
  });

  it("places BYOM entries in the ai-models category", () => {
    const byom = INTEGRATIONS_CATALOG.filter((e) => e.id === "openai");
    expect(byom[0]?.category).toBe("ai-models");
  });

  it("uses oauth auth type only for google and slack", () => {
    const oauth = INTEGRATIONS_CATALOG.filter(
      (e) => e.authType === "oauth",
    ).map((e) => e.id);
    expect(oauth.sort()).toEqual(["google", "slack"]);
  });

  it("provides help text for every entry", () => {
    for (const entry of INTEGRATIONS_CATALOG) {
      expect(entry.helpText.length).toBeGreaterThan(0);
    }
  });

  it("requires a credential placeholder + label for api-key entries", () => {
    for (const entry of INTEGRATIONS_CATALOG) {
      if (entry.authType === "api-key") {
        expect(entry.credentialLabel.length).toBeGreaterThan(0);
        expect(entry.credentialPlaceholder.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("getCatalogEntry", () => {
  it("returns the entry for a known id", () => {
    const entry = getCatalogEntry("openai");
    expect(entry?.name).toBe("OpenAI");
  });

  it("returns undefined for an unknown id", () => {
    expect(getCatalogEntry("nope")).toBeUndefined();
  });
});

describe("CATEGORY_ORDER", () => {
  it("lists all three categories", () => {
    expect(CATEGORY_ORDER).toEqual(["communication", "tools", "ai-models"]);
  });
});
