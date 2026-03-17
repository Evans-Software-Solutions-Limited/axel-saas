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

  it("returns null when user messages contain no recognisable keywords", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "Hi, my name is Alex" }],
    });
    expect(result).toBeNull();
  });

  it("does not recommend developer when user mentions executive (exec false positive)", () => {
    const result = getRecommendedPlan({
      messages: [
        {
          role: "user",
          content: "I am an executive at a large company",
        },
      ],
    });
    // "executive" contains "exec" as a substring — must not trigger developer tier
    expect(result?.tierId).not.toBe("developer");
  });

  it("still recommends developer when user explicitly says exec", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I want exec access to scripts" }],
    });
    expect(result?.tierId).toBe("developer");
  });

  it("recommends developer when user mentions api", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I need api access and scripting" }],
    });
    expect(result?.tierId).toBe("developer");
  });

  it("recommends developer when user mentions code or programming", () => {
    const result = getRecommendedPlan({
      messages: [
        { role: "user", content: "I do a lot of coding and programming" },
      ],
    });
    expect(result?.tierId).toBe("developer");
  });

  it("recommends business when user mentions team", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I manage a team of 10 people" }],
    });
    expect(result?.tierId).toBe("business");
  });

  it("recommends business when user mentions company or organisation", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I run a small organisation" }],
    });
    expect(result?.tierId).toBe("business");
  });

  it("recommends pro when user mentions calendar", () => {
    const result = getRecommendedPlan({
      messages: [
        { role: "user", content: "I need help with calendar management" },
      ],
    });
    expect(result?.tierId).toBe("pro");
  });

  it("recommends pro when user mentions email", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I want to automate my email" }],
    });
    expect(result?.tierId).toBe("pro");
  });

  it("recommends starter when user mentions telegram", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I use telegram mainly" }],
    });
    expect(result?.tierId).toBe("starter");
  });

  it("recommends starter when user mentions daily brief", () => {
    const result = getRecommendedPlan({
      messages: [{ role: "user", content: "I just want a daily brief" }],
    });
    expect(result?.tierId).toBe("starter");
  });

  it("developer takes priority over pro when both keywords are present", () => {
    const result = getRecommendedPlan({
      messages: [
        { role: "user", content: "I need api access and email automation" },
      ],
    });
    expect(result?.tierId).toBe("developer");
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

  it("returned tierId matches a known paid plan", () => {
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
  it("contains at least 4 paid tiers", () => {
    const paid = PLANS.filter((p) => p.tierId !== null);
    expect(paid.length).toBeGreaterThanOrEqual(4);
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
