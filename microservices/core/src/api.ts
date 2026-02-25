import Elysia from "elysia";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";
import { cors } from "hono/cors";

import { supabaseAuth } from "@axel-saas/api-utils/auth/supabaseAuth";
import { stripeHandler } from "./application/stripe/stripeHandler";
import { subscriptionHandler } from "./application/subscriptions/subscriptionHandler";
import { userHandler } from "./application/users/userHandler";

// Get allowed origins from environment variables
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // In development, allow localhost
  if (process.env.NODE_ENV !== "production") {
    origins.push("http://localhost:5173");
    origins.push("http://localhost:5174");
    origins.push("http://localhost:3000");
  }

  // Add frontend URL from env (for deployed environments)
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  // Always include production frontend URL if set via SST
  if (process.env.VITE_WEB_URL) {
    origins.push(process.env.VITE_WEB_URL);
  }

  return origins.length > 0 ? origins : ["http://localhost:5173"];
};

const hono = new Hono();

// Apply CORS middleware globally
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
  .use(stripeHandler)
  .use(supabaseAuth)
  .use(userHandler)
  .use(subscriptionHandler);

export type CoreApi = typeof app;

export const handler = handle(hono.mount("/", app.fetch));
