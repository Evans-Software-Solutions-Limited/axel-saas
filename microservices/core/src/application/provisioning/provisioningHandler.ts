import Elysia, { t } from "elysia";
import { ProvisioningRepository } from "../repositories/provisioningRepository";

const provisioningRepo = new ProvisioningRepository();

/**
 * Internal provisioning endpoints — not user-facing.
 *
 * POST /provisioning/register
 *   Called by a container when it is ready to serve traffic.
 *   Protected by X-Provisioning-Secret (shared secret in PROVISIONING_SECRET
 *   env var).
 *
 *   Auth behaviour:
 *   - PROVISIONING_SECRET set: header must match (401 otherwise).
 *   - PROVISIONING_SECRET unset + NODE_ENV=production: fail-closed (503).
 *   - PROVISIONING_SECRET unset + any other NODE_ENV: skip check (dev
 *     convenience — allows local development without a running orchestrator).
 */
export const provisioningHandler = new Elysia({
  name: "ProvisioningHandler",
}).post(
  "/provisioning/register",
  async ({ body, headers, set }) => {
    const secret = process.env.PROVISIONING_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        set.status = 503;
        return { success: false, error: "Provisioning secret not configured" };
      }
      // Non-production without a configured secret: skip auth (dev convenience).
    } else if (headers["x-provisioning-secret"] !== secret) {
      set.status = 401;
      return { success: false, error: "Unauthorized" };
    }

    const { userId, gatewayUrl } = body;

    const prov = await provisioningRepo.findByUserId(userId);
    if (!prov) {
      set.status = 404;
      return {
        success: false,
        error: "Provisioning state not found for user",
      };
    }

    await provisioningRepo.activateGateway(userId, gatewayUrl);

    return { success: true, userId };
  },
  {
    body: t.Object({
      userId: t.String({ minLength: 1 }),
      gatewayUrl: t.String({ minLength: 1 }),
    }),
    detail: {
      description:
        "Register a container gateway URL — marks provisioning as active",
      tags: ["Provisioning"],
    },
  },
);
