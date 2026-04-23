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

    it("does not false-positive on 'current' (contains 'rent' as substring)", () => {
      expect(classifyMessage("current 3 tenants need attention")).toBe("clean");
    });

    it("does not false-positive on 'parent' (contains 'rent' as substring)", () => {
      expect(classifyMessage("contact the parent 5 times this week")).toBe(
        "clean",
      );
    });

    it("does not false-positive on 'different' (contains 'rent' as substring)", () => {
      expect(classifyMessage("different 10 options available")).toBe("clean");
    });

    it("prioritises financial-data over pii-suspected when both present", () => {
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
  it("returns the free policy", () => {
    const policy = getRoutingPolicy("free");
    expect(policy).toEqual(TIER_ROUTING_MATRIX.free);
    expect(policy.tier).toBe("free");
    expect(policy.externalCallsPermitted).toBe(false);
  });

  it("returns the premium policy", () => {
    const policy = getRoutingPolicy("premium");
    expect(policy).toEqual(TIER_ROUTING_MATRIX.premium);
    expect(policy.auditLogging).toBe(true);
    expect(policy.piiHandling).toBe("anonymize");
    expect(policy.allowedDataClassifications).toContain("financial-data");
  });

  it("returns the enterprise policy", () => {
    const policy = getRoutingPolicy("enterprise");
    expect(policy.externalCallsPermitted).toBe(true);
    expect(policy.cloudModelFallback).toBe(true);
    expect(policy.piiHandling).toBe("anonymize");
  });

  it("throws for an unknown tier", () => {
    expect(() =>
      // @ts-expect-error intentional invalid tier for runtime test
      getRoutingPolicy("unknown"),
    ).toThrow("Unknown subscription tier: unknown");
  });
});

// ---------------------------------------------------------------------------
// resolveRoutingCategory
// ---------------------------------------------------------------------------

describe("resolveRoutingCategory", () => {
  const freePolicy: RoutingPolicy = TIER_ROUTING_MATRIX.free;
  const premiumPolicy: RoutingPolicy = TIER_ROUTING_MATRIX.premium;
  const enterprisePolicy: RoutingPolicy = TIER_ROUTING_MATRIX.enterprise;

  describe("clean and anonymized messages", () => {
    it("always returns cloud-direct for clean data on any tier", () => {
      expect(resolveRoutingCategory("clean", freePolicy)).toBe("cloud-direct");
      expect(resolveRoutingCategory("clean", premiumPolicy)).toBe(
        "cloud-direct",
      );
      expect(resolveRoutingCategory("clean", enterprisePolicy)).toBe(
        "cloud-direct",
      );
    });

    it("returns cloud-direct for anonymized data on any tier", () => {
      expect(resolveRoutingCategory("anonymized", freePolicy)).toBe(
        "cloud-direct",
      );
      expect(resolveRoutingCategory("anonymized", premiumPolicy)).toBe(
        "cloud-direct",
      );
    });
  });

  describe("pii-suspected messages", () => {
    it("free refuses pii-suspected (not in allowedDataClassifications)", () => {
      expect(resolveRoutingCategory("pii-suspected", freePolicy)).toBe(
        "refused",
      );
    });

    it("premium anonymizes pii-suspected", () => {
      expect(resolveRoutingCategory("pii-suspected", premiumPolicy)).toBe(
        "cloud-post-anonymize",
      );
    });

    it("enterprise anonymizes pii-suspected", () => {
      expect(resolveRoutingCategory("pii-suspected", enterprisePolicy)).toBe(
        "cloud-post-anonymize",
      );
    });
  });

  describe("financial-data messages", () => {
    it("free refuses financial-data", () => {
      expect(resolveRoutingCategory("financial-data", freePolicy)).toBe(
        "refused",
      );
    });

    it("premium anonymizes financial-data", () => {
      expect(resolveRoutingCategory("financial-data", premiumPolicy)).toBe(
        "cloud-post-anonymize",
      );
    });

    it("enterprise anonymizes financial-data", () => {
      expect(resolveRoutingCategory("financial-data", enterprisePolicy)).toBe(
        "cloud-post-anonymize",
      );
    });
  });

  describe("synthetic policies (exercising the full decision table)", () => {
    it("returns log-and-forward when a policy uses log-only piiHandling", () => {
      const logOnlyPolicy: RoutingPolicy = {
        ...premiumPolicy,
        piiHandling: "log-only",
      };
      expect(resolveRoutingCategory("pii-suspected", logOnlyPolicy)).toBe(
        "log-and-forward",
      );
    });

    it("returns refused when piiHandling is refuse even if classification is allowed", () => {
      const refusePolicy: RoutingPolicy = {
        ...premiumPolicy,
        piiHandling: "refuse",
      };
      expect(resolveRoutingCategory("pii-suspected", refusePolicy)).toBe(
        "refused",
      );
    });
  });
});

// ---------------------------------------------------------------------------
// buildTaskEnvelope
// ---------------------------------------------------------------------------

describe("buildTaskEnvelope", () => {
  it("builds a complete envelope for a clean message on the free tier", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-123",
      tier: "free",
      rawMessage: "What's on my schedule?",
    });

    expect(envelope.userId).toBe("user-123");
    expect(envelope.tier).toBe("free");
    expect(envelope.rawMessage).toBe("What's on my schedule?");
    expect(envelope.dataClassification).toBe("clean");
    expect(envelope.routingCategory).toBe("cloud-direct");
    expect(envelope.policy).toEqual(TIER_ROUTING_MATRIX.free);
    expect(envelope.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("classifies PII and produces refused for the free tier", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-456",
      tier: "free",
      rawMessage: "Tenant at SW1A 1AA needs a reply",
    });

    // SW1A 1AA is a postcode → pii-suspected; free refuses PII
    expect(envelope.dataClassification).toBe("pii-suspected");
    expect(envelope.routingCategory).toBe("refused");
  });

  it("classifies PII and anonymizes for the premium tier", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-789",
      tier: "premium",
      rawMessage: "Email jane@example.com about the meeting",
    });

    expect(envelope.dataClassification).toBe("pii-suspected");
    expect(envelope.routingCategory).toBe("cloud-post-anonymize");
  });

  it("classifies financial data and anonymizes for the premium tier", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-000",
      tier: "premium",
      rawMessage: "Tenant owes £1,200 in arrears",
    });

    expect(envelope.dataClassification).toBe("financial-data");
    expect(envelope.routingCategory).toBe("cloud-post-anonymize");
  });

  it("respects an explicit dataClassification override", () => {
    const envelope = buildTaskEnvelope({
      userId: "user-111",
      tier: "free",
      rawMessage: "jane@example.com has a query",
      dataClassification: "anonymized",
    });

    expect(envelope.dataClassification).toBe("anonymized");
    expect(envelope.routingCategory).toBe("cloud-direct");
  });

  it("includes a valid ISO-8601 createdAt timestamp", () => {
    const before = Date.now();
    const envelope = buildTaskEnvelope({
      userId: "u",
      tier: "premium",
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
  const tiers = ["free", "premium", "enterprise"] as const;

  it("defines a policy for every tier", () => {
    for (const tier of tiers) {
      expect(TIER_ROUTING_MATRIX[tier]).toBeDefined();
      expect(TIER_ROUTING_MATRIX[tier].tier).toBe(tier);
    }
  });

  it("free does not permit external calls or cloud fallback", () => {
    expect(TIER_ROUTING_MATRIX.free.externalCallsPermitted).toBe(false);
    expect(TIER_ROUTING_MATRIX.free.cloudModelFallback).toBe(false);
  });

  it("premium and enterprise permit cloud fallback and audit logging", () => {
    for (const tier of ["premium", "enterprise"] as const) {
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
