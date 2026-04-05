import Elysia from "elysia";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";

import { stripeHandler } from "./application/stripe/stripeHandler";
import {
  subscriptionPublicHandler,
  subscriptionHandler,
} from "./application/subscriptions/subscriptionHandler";
import { userHandler } from "./application/users/userHandler";
import { onboardingHandler } from "./application/onboarding/onboardingHandler";
import { chatHandler } from "./application/chat/chatHandler";
import { provisioningHandler } from "./application/provisioning/provisioningHandler";
import { waitlistHandler } from "./application/waitlist/waitlistHandler";
import { taskHandler } from "./application/tasks/taskHandler";
import { integrationHandler } from "./application/integrations/integrationHandler";

const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:5173");
    origins.push("http://localhost:5174");
    origins.push("http://localhost:3000");
  }

  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  if (process.env.VITE_WEB_URL) {
    origins.push(process.env.VITE_WEB_URL);
  }

  return origins.length > 0 ? origins : ["http://localhost:5173"];
};

const hono = new Hono();

hono.use(
  "*",
  cors({
    origin: getAllowedOrigins(),
    allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    maxAge: 3600,
  }),
);

const app = new Elysia()
  .get("/health", () => ({ status: "ok" }))
  // Stripe webhook — unauthenticated (Stripe signs payloads itself)
  .use(stripeHandler)
  // Public waitlist routes — no auth
  .use(waitlistHandler)
  // Public subscription routes — no auth
  .use(subscriptionPublicHandler)
  // Protected routes — each handler applies supabaseAuth internally
  .use(userHandler)
  .use(onboardingHandler)
  .use(chatHandler)
  .use(subscriptionHandler)
  .use(provisioningHandler)
  .use(taskHandler)
  .use(integrationHandler);

export type CoreApi = typeof app;

export const handler = handle(hono.mount("/", app.fetch));
