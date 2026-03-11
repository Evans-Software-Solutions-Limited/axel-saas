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
  // Public subscription routes — no auth
  .use(subscriptionPublicHandler)
  // Protected routes — each handler applies supabaseAuth internally
  .use(userHandler)
  .use(onboardingHandler)
  .use(subscriptionHandler);

export type CoreApi = typeof app;

export const handler = handle(hono.mount("/", app.fetch));
