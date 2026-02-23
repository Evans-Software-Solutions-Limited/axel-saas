import Elysia from "elysia";
import { Hono } from "hono";
import { handle } from "hono/aws-lambda";

import { supabaseAuth } from "@axel-saas/api-utils/auth/supabaseAuth";
import { stripeHandler } from "./application/stripe/stripeHandler";
import { subscriptionHandler } from "./application/subscriptions/subscriptionHandler";
import { userHandler } from "./application/users/userHandler";

const app = new Elysia()
  .get("/health", () => ({ status: "ok" }))
  .use(stripeHandler)
  .use(supabaseAuth)
  .use(userHandler)
  .use(subscriptionHandler);

export type CoreApi = typeof app;

export const handler = handle(new Hono().mount("/", app.fetch));
