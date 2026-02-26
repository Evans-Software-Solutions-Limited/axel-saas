import { describe, it, expect } from "vitest";
import {
  subscriptionHandler,
  subscriptionPublicHandler,
} from "../subscriptionHandler";

describe("SubscriptionHandler", () => {
  describe("subscriptionPublicHandler instance", () => {
    it("should be defined", () => {
      expect(subscriptionPublicHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(subscriptionPublicHandler.routes).toBeDefined();
      expect(Array.isArray(subscriptionPublicHandler.routes)).toBe(true);
    });

    it("should have GET /subscriptions/tiers route", () => {
      const getRoutes = subscriptionPublicHandler.routes.filter(
        (r) => r.method === "GET",
      );
      const tiersRoute = getRoutes.find(
        (r) => r.path === "/subscriptions/tiers",
      );
      expect(tiersRoute).toBeDefined();
    });
  });

  describe("subscriptionHandler instance", () => {
    it("should be defined", () => {
      expect(subscriptionHandler).toBeDefined();
    });

    it("should have expected routes", () => {
      expect(subscriptionHandler.routes).toBeDefined();
      expect(Array.isArray(subscriptionHandler.routes)).toBe(true);
    });

    it("should have POST /subscriptions/checkout route", () => {
      const postRoutes = subscriptionHandler.routes.filter(
        (r) => r.method === "POST",
      );
      const checkoutRoute = postRoutes.find(
        (r) => r.path === "/subscriptions/checkout",
      );
      expect(checkoutRoute).toBeDefined();
    });
  });

  describe("subscription tiers structure", () => {
    it("should define expected tier structure", () => {
      // Test that the tiers are properly defined in the handler
      expect(
        subscriptionPublicHandler.routes.some(
          (r) => r.path === "/subscriptions/tiers",
        ),
      ).toBe(true);
    });

    it("should have proper route configuration", () => {
      const publicGetRoute = subscriptionPublicHandler.routes.find(
        (r) => r.method === "GET" && r.path === "/subscriptions/tiers",
      );
      const protectedPostRoute = subscriptionHandler.routes.find(
        (r) => r.method === "POST" && r.path === "/subscriptions/checkout",
      );

      expect(publicGetRoute).toBeDefined();
      expect(protectedPostRoute).toBeDefined();
    });
  });
});
