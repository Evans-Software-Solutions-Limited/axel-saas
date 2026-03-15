import Elysia, { t } from "elysia";
import { ProvisioningRepository } from "../repositories/provisioningRepository";

const provisioningRepo = new ProvisioningRepository();

/**
 * Internal provisioning endpoints — not user-facing.
 *
 * POST /provisioning/register
 *   Called by a container when it is ready to serve traffic.
 *   Protected by X-Provisioning-Secret (shared secret in PROVISIONING_SECRET
 *   env var). If the env var is unset the check is skipped (dev convenience).
 */
export const provisioningHandler = new Elysia({
  name: "ProvisioningHandler",
}).post(
  "/provisioning/register",
  async ({ body, headers, set }) => {
    const secret = process.env.PROVISIONING_SECRET;
    if (!secret) {
      set.status = 503;
      return { success: false, error: "Provisioning secret not configured" };
    }
    const provided = headers["x-provisioning-secret"];
    if (provided !== secret) {
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
