import { describe, it, expect } from "vitest";
import { getRecommendedPlan, PLANS } from "../planRecommendation";

describe("getRecommendedPlan", () => {
  it("returns null when no signals are provided", () => {
    expect(getRecommendedPlan()).toBeNull();
  });

  it("returns null when signals has no messages", () => {
    expect(getRecommendedPlan({})).toBeNull();
  });

  it("returns null when messages array is empty", () => {
    expect(getRecommendedPlan({ messages: [] })).toBeNull();
  });

  it("returns null when there are only assistant messages", () => {
    expect(
      getRecommendedPlan({
        messages: [{ role: "assistant", content: "What should I call you?" }],
      }),
    ).toBeNull();
  });

  it("returns null when user messages contain only whitespace", () => {
    expect(
      getRecommendedPlan({
        messages: [{ role: "user", content: "   " }],
      }),
    ).toBeNull();
  });

  it("returns null when user messages contain no Premium keywords", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "Hi, my name is Alex" }],
    });
    expect(result).toBeNull();
  });

  it("recommends Premium when the user mentions api", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I need api access and scripting" }],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions code or programming", () => {
    const result = getRecommendedPlan({
      messages: [
        { role: "user", content: "I do a lot of coding and programming" },
      ],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions calendar", () => {
    const result = getRecommendedPlan({
      messages: [
        { role: "user", content: "I need help with calendar management" },
      ],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions email", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I want to automate my email" }],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions integrations", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I need integrations with Slack" }],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions a team", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I manage a team of 10 people" }],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions emails (plural)", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "automate my emails" }],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("recommends Premium when the user mentions meetings (plural)", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I have a lot of meetings" }],
    });
    expect(result?.tierId).toBe("premium");
  });

  it("does not match 'developer' inside another word (boundary check)", () => {
    // "redeveloper" contains "developer" as a substring but must not match
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I am a redeveloperish" }],
    });
    expect(result).toBeNull();
  });

  it("returned recommendation has a non-empty reason", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I need calendar and email" }],
    });
    expect(result?.reason.length).toBeGreaterThan(10);
  });

  it("returned recommendation has a non-empty shortReason", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I need calendar and email" }],
    });
    expect(result?.shortReason.length).toBeGreaterThan(0);
  });

  it("returned tierId matches a known plan", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I need calendar and email" }],
    });
    const match = PLANS.find((p) => p.tierId === result?.tierId);
    expect(match).toBeDefined();
  });

  it("is deterministic — same signals return the same result", () => {
    const signals = {
      messages: [{ role: "user", content: "I need calendar and email" }],
    };
    const first = getRecommendedPlan(signals);
    const second = getRecommendedPlan(signals);
    expect(first?.tierId).toBe(second?.tierId);
    expect(first?.reason).toBe(second?.reason);
    expect(first?.shortReason).toBe(second?.shortReason);
  });
});

describe("PLANS", () => {
  it("contains exactly Free, Premium and Enterprise", () => {
    const names = PLANS.map((p) => p.name);
    expect(names).toEqual(["Free", "Premium", "Enterprise"]);
  });

  it("Free plan has tierId 'free'", () => {
    const free = PLANS.find((p) => p.name === "Free");
    expect(free?.tierId).toBe("free");
    expect(free?.price).toBe("£0");
  });

  it("Premium plan has tierId 'premium' at £49", () => {
    const premium = PLANS.find((p) => p.name === "Premium");
    expect(premium?.tierId).toBe("premium");
    expect(premium?.price).toBe("£49");
    expect(premium?.period).toBe("/month");
  });

  it("Enterprise plan has null tierId (not self-serve)", () => {
    const enterprise = PLANS.find((p) => p.name === "Enterprise");
    expect(enterprise?.tierId).toBeNull();
    expect(enterprise?.price).toBe("Contact us");
  });

  it("each plan has a non-empty description and tagline", () => {
    PLANS.forEach((plan) => {
      expect(plan.description.length).toBeGreaterThan(0);
      expect(plan.tagline.length).toBeGreaterThan(0);
    });
  });

  it("each plan has at least one feature", () => {
    PLANS.forEach((plan) => {
      expect(plan.features.length).toBeGreaterThanOrEqual(1);
    });
  });
});
