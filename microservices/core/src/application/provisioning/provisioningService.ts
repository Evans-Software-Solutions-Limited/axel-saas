import { ProvisioningRepository } from "../repositories/provisioningRepository";

export interface ContainerLaunchParams {
  userId: string;
  tier: string;
  workspacePath: string;
}

/**
 * Trigger container launch for a newly provisioned user.
 *
 * In production: POSTs to PROVISIONING_WEBHOOK_URL — the endpoint that the
 * container orchestrator (ECS task runner, k8s operator, etc.) listens on.
 *
 * In development (no PROVISIONING_WEBHOOK_URL set): no-ops with a log so the
 * rest of the stack can be exercised without a running orchestrator.
 *
 * The caller is responsible for ensuring a provisioning_state row already
 * exists (status="pending") before calling this function.
 */
export async function triggerContainerLaunch(
  provisioningRepo: ProvisioningRepository,
  params: ContainerLaunchParams,
): Promise<void> {
  const prov = await provisioningRepo.findByUserId(params.userId);
  if (!prov) {
    throw new Error(
      `No provisioning state found for user ${params.userId} — cannot trigger launch`,
    );
  }

  // Idempotency guard: a replayed webhook must not regress an already-active
  // container back to "provisioning".
  if (prov.status === "active") {
    return;
  }

  // Advance status to "provisioning" so the UI can show a loading state
  await provisioningRepo.updateStatus(prov.id, "provisioning");

  const webhookUrl = process.env.PROVISIONING_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(
      `[provisioning] PROVISIONING_WEBHOOK_URL not set — skipping container launch for user ${params.userId}`,
    );
    return;
  }

  const secret = process.env.PROVISIONING_WEBHOOK_SECRET;

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Provisioning-Secret": secret } : {}),
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await provisioningRepo.updateStatus(
      prov.id,
      "failed",
      `Webhook fetch error: ${message}`,
    );
    throw err;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    // Roll back to "failed" so the admin / retry logic can act on it
    await provisioningRepo.updateStatus(
      prov.id,
      "failed",
      `Webhook ${response.status}: ${errorText}`,
    );
    throw new Error(
      `Provisioning webhook returned ${response.status}: ${errorText}`,
    );
  }
}
