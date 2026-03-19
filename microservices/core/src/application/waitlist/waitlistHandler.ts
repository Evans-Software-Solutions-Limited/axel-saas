import Elysia, { t } from "elysia";
import { getDb } from "@axel-saas/db";
import { WaitlistRepository, NotFoundError } from "./waitlistRepository";
import { sendJoinConfirmation, sendUpdateConfirmation } from "./waitlistEmail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiter: max 10 requests per minute per IP.
// Note: this is per-instance only — production should use a distributed store.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const limit = 10;

  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + window });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

export const waitlistHandler = new Elysia({ name: "WaitlistHandler" })
  .post(
    "/waitlist",
    async (ctx) => {
      const { body, set, request } = ctx;
      const { email, interestedIn } = body;

      // IP-based rate limiting
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "unknown";
      if (isRateLimited(ip)) {
        set.status = 429;
        return { success: false, error: "Too many requests" };
      }

      if (!EMAIL_REGEX.test(email)) {
        set.status = 422;
        return { success: false, error: "Invalid email format" };
      }

      const repo = new WaitlistRepository(getDb());
      const { record, isNew } = await repo.upsertByEmail(email, interestedIn);

      // Fire-and-forget — do not block the HTTP response
      if (isNew) {
        void sendJoinConfirmation(
          record.email,
          record.interestedIn,
          record.token,
        );
      } else {
        void sendUpdateConfirmation(
          record.email,
          record.interestedIn,
          record.token,
        );
      }

      set.status = isNew ? 201 : 200;
      return { status: isNew ? "joined" : "updated" };
    },
    {
      body: t.Object({
        email: t.String({ minLength: 1 }),
        interestedIn: t.Union([
          t.Literal("free"),
          t.Literal("pro"),
          t.Literal("enterprise"),
        ]),
      }),
      detail: {
        description: "Join or update tier preference on the waitlist",
        tags: ["Waitlist"],
      },
    },
  )
  .delete(
    "/waitlist/unsubscribe",
    async (ctx) => {
      const { query, set } = ctx;
      const { token } = query;

      const repo = new WaitlistRepository(getDb());
      try {
        await repo.deleteByToken(token);
        return { status: "removed" };
      } catch (err) {
        if (err instanceof NotFoundError) {
          set.status = 404;
          return { success: false, error: "Token not found" };
        }
        throw err;
      }
    },
    {
      query: t.Object({
        token: t.String({ minLength: 1 }),
      }),
      detail: {
        description:
          "Unsubscribe from the waitlist using the token from the confirmation email",
        tags: ["Waitlist"],
      },
    },
  );
