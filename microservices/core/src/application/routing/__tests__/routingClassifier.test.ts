import { describe, it, expect } from "vitest";

import {
  classifyMessage,
  getRoutingPolicy,
  resolveRoutingCategory,
  buildTaskEnvelope,
} from "../routingClassifier";
import { TIER_ROUTING_MATRIX } from "../routingTypes";
import type { DataClassification, RoutingPolicy } from "../routingTypes";

// ---------------------------------------------------------------------------
// classifyMessage
// ---------------------------------------------------------------------------

describe("classifyMessage", () => {
  describe("clean messages", () => {
    it("returns clean for a plain text message", () => {
      expect(classifyMessage("What tasks do I have today?")).toBe("clean");
    });

    it("returns clean for an empty string", () => {
      expect(classifyMessage("")).toBe("clean");
    });

    it("returns clean for messages with numbers that are not PII", () => {
      expect(classifyMessage("Remind me in 3 days to submit the report")).toBe(
        "clean",
      );
    });

    it("returns clean for a URL without PII", () => {
      expect(classifyMessage("Check the docs at https://example.com")).toBe(
        "clean",
      );
    });
  });

  describe("PII detection", () => {
    it("detects an email address", () => {
      expect(classifyMessage("Contact alice@example.com for details")).toBe(
        "pii-suspected",
      );
    });

    it("detects a UK mobile number", () => {
      expect(classifyMessage("Call me on 07700 900123")).toBe("pii-suspected");
    });

    it("detects a +44 phone number", () => {
      expect(classifyMessage("Ring +44 7700 900456 tomorrow")).toBe(
        "pii-suspected",
      );
    });

    it("detects a UK postcode", () => {
      expect(classifyMessage("Deliver to SW1A 1AA please")).toBe(
        "pii-suspected",
      );
    });

    it("detects a National Insurance number", () => {
      expect(classifyMessage("NI number: AB123456C")).toBe("pii-suspected");
    });

    it("detects a sort code", () => {
      expect(classifyMessage("Sort code is 20-00-00")).toBe("pii-suspected");
    });

    it("detects an 8-digit bank account number", () => {
      expect(classifyMessage("Account number 12345678")).toBe("pii-suspected");
    });
  });

  describe("financial data detection", () => {
    it("detects a GBP currency amount", () => {
      expect(classifyMessage("Invoice total is £1,200")).toBe("financial-data");
    });

    it("detects a USD amount", () => {
      expect(classifyMessage("Bill comes to $500 this month")).toBe(
        "financial-data",
      );
    });

    it("detects an EUR amount", () => {
      expect(classifyMessage("Fee is €99")).toBe("financial-data");
    });

    it("detects 'owes' + currency phrase", () => {
      expect(classifyMessage("Tenant owes £800 in rent arrears")).toBe(
        "financial-data",
      );
    });

    it("detects 'rent of' phrase", () => {
      expect(classifyMessage("Rent of £1,500 is due on the 1st")).toBe(
        "financial-data",
      );
    });

    it("prioritises financial-data over pii-suspected when both present", () => {
      // Contains both a sort code (PII) and a currency amount (financial)
      expect(classifyMessage("Account 20-00-00 owes £300")).toBe(
        "financial-data",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// getRoutingPolicy
// ---------------------------------------------------------------------------

describe("getRoutingPolicy", () => {
  it("returns the starter policy", () => {
    const policy = getRoutingPolicy("starter");
    expect(policy).toEqual(TIER_ROUTING_MATRIX.starter);
    expect(policy.tier).toBe("starter");
  });

  it("returns the pro policy", () => {
    const policy = getRoutingPolicy("pro");
    expect(policy).toEqual(TIER_ROUTING_MATRIX.pro);
    expect(policy.auditLogging).toBe(true);
  });

  it("returns the business policy", () => {
    const policy = getRoutingPolicy("business");
    expect(policy.piiHandling).toBe("anonymize");
    expect(policy.allowedDataClassifications).toContain("financial-data");
  });

  it("returns the developer policy", () => {
    const policy = getRoutingPolicy("developer");
    expect(policy.externalCallsPermitted).toBe(true);
    expect(policy.cloudModelFallback).toBe(true);
  });

  it("throws for an unknown tier", () => {
    expect(() =>
      // @ts-expect-error intentional invalid tier for runtime test
      getRoutingPolicy("enterprise"),
    ).toThrow("Unknown subscription tier: enterprise");
  });
});

// ---------------------------------------------------------------------------
// resolveRoutingCategory
// ---------------------------------------------------------------------------

describe("resolveRoutingCategory", () => {
  const starterPolicy: RoutingPolicy = TIER_ROUTING_MATRIX.starter;
  const proPolicy: RoutingPolicy = TIER_ROUTING_MATRIX.pro;
  const businessPolicy: RoutingPolicy = TIER_ROUTING_MATRIX.business;

  describe("clean messages", () => {
    it("always returns cloud-direct for clean data on any tier", () => {
      expect(resolveRoutingCategory("clean", starterPolicy)).toBe(
        "cloud-direct",
      );
      expect(resolveRoutingCategory("clean", proPolicy)).toBe("cloud-direct");
      expect(resolveRoutingCategory("clean", businessPolicy)).toBe(
        "cloud-direct",
      );
    });

    it("returns cloud-direct for anonymized data", () => {
      expect(resolveRoutingCategory("anonymized", starterPolicy)).toBe(
        "cloud-direct",
      );
    });
  });

  describe("pii-suspected messages", () => {
    it("starter refuses pii-suspected (not in allowedDataClassifications)", () => {
      expect(resolveRoutingCategory("pii-suspected", starterPolicy)).toBe(
        "refused",
      );
    });

    it("pro logs-and-forwards pii-suspected", () => {
      expect(resolveRoutingCategory("pii-suspected", proPolicy)).toBe(
        "log-and-forward",
      );
    });

    it("business anonymizes pii-suspected", () => {
      expect(resolveRoutingCategory("pii-suspected", businessPolicy)).toBe(
        "cloud-post-anonymize",
      );
    });
  });

  describe("financial-data messages", () => {
    it("starter refuses financial-data (not in allowedDataClassifications)", () => {
      expect(resolveRoutingCategory("financial-data", starterPolicy)).toBe(
        "refused",
      );
    });

    it("pro refuses financial-data (not in allowedDataClassifications)", () => {
      // Pro allows pii-suspected but not financial-data
      expect(resolveRoutingCategory("financial-data", proPolicy)).toBe(
        "refused",
      );
    });

    it("business anonymizes financial-data", () => {
      expect(resolveRoutingCategory("financial-data", businessPolicy)).toBe(
        "cloud-post-anonymize",
      );
    });

    it("developer anonymizes financial-data", () => {
      expect(
        resolveRoutingCategory("financial-data", TIER_ROUTING_MATRIX.developer),
      ).toBe("cloud-post-anonymize");
    });
  });

  describe("edge: custom policy with refuse handling", () => {
    it("returns refused when piiHandling is refuse regardless of allowedClassifications", () => {
      const refuseAllPolicy: RoutingPolicy = {
        ...businessPolicy,
        piiHandling: "refuse",
      };
      expect(resolveRoutingCategory("pii-suspected", refuseAllPolicy)).toBe(
        "refused",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// buildTaskEnvelope
// ---------------------------------------------------------------------------

describe("buildTaskEnvelope", () => {
  it("builds a complete envelope for a clean message on starter tier", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-123",
      tier: "starter",
      rawMessage: "What's on my schedule?",
    });

    expect(envelope.userId).toBe("user-123");
    expect(envelope.tier).toBe("starter");
    expect(envelope.rawMessage).toBe("What's on my schedule?");
    expect(envelope.dataClassification).toBe("clean");
    expect(envelope.routingCategory).toBe("cloud-direct");
    expect(envelope.policy).toEqual(TIER_ROUTING_MATRIX.starter);
    expect(envelope.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("classifies PII and produces refused for starter", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-456",
      tier: "starter",
      rawMessage: "Tenant at SW1A 1AA owes money",
    });

    // SW1A 1AA is a postcode → pii-suspected; starter refuses pii
    expect(envelope.dataClassification).toBe("pii-suspected");
    expect(envelope.routingCategory).toBe("refused");
  });

  it("classifies PII and produces log-and-forward for pro", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-789",
      tier: "pro",
      rawMessage: "Email jane@example.com about the meeting",
    });

    expect(envelope.dataClassification).toBe("pii-suspected");
    expect(envelope.routingCategory).toBe("log-and-forward");
  });

  it("classifies financial data and anonymizes for business", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-000",
      tier: "business",
      rawMessage: "Tenant owes £1,200 in arrears",
    });

    expect(envelope.dataClassification).toBe("financial-data");
    expect(envelope.routingCategory).toBe("cloud-post-anonymize");
  });

  it("respects an explicit dataClassification override", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-111",
      tier: "starter",
      rawMessage: "jane@example.com has a query",
      // Upstream anonymiser already scrubbed the message
      dataClassification: "anonymized",
    });

    expect(envelope.dataClassification).toBe("anonymized");
    expect(envelope.routingCategory).toBe("cloud-direct");
  });

  it("includes a valid ISO-8601 createdAt timestamp", () => {
    const before = Date.now();
    const envelope = buildTaskEnvelope({
      userId: "u",
      tier: "pro",
      rawMessage: "hello",
    });
    const after = Date.now();
    const ts = new Date(envelope.createdAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// TIER_ROUTING_MATRIX structural invariants
// ---------------------------------------------------------------------------

describe("TIER_ROUTING_MATRIX structural invariants", () => {
  const tiers = ["starter", "pro", "business", "developer"] as const;

  it("defines a policy for every tier", () => {
    for (const tier of tiers) {
      expect(TIER_ROUTING_MATRIX[tier]).toBeDefined();
      expect(TIER_ROUTING_MATRIX[tier].tier).toBe(tier);
    }
  });

  it("starter does not permit external calls or cloud fallback", () => {
    expect(TIER_ROUTING_MATRIX.starter.externalCallsPermitted).toBe(false);
    expect(TIER_ROUTING_MATRIX.starter.cloudModelFallback).toBe(false);
  });

  it("business and developer permit cloud fallback and audit logging", () => {
    for (const tier of ["business", "developer"] as const) {
      expect(TIER_ROUTING_MATRIX[tier].cloudModelFallback).toBe(true);
      expect(TIER_ROUTING_MATRIX[tier].auditLogging).toBe(true);
    }
  });

  it("every allowedDataClassifications list is non-empty", () => {
    for (const tier of tiers) {
      expect(
        TIER_ROUTING_MATRIX[tier].allowedDataClassifications.length,
      ).toBeGreaterThan(0);
    }
  });

  it("clean is always an allowed classification", () => {
    for (const tier of tiers) {
      expect(TIER_ROUTING_MATRIX[tier].allowedDataClassifications).toContain(
        "clean" satisfies DataClassification,
      );
    }
  });
});
