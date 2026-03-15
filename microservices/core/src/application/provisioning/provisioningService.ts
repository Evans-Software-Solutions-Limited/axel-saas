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

  // Idempotency guard: skip only when a real container is already running.
  //
  // A container is "really" active when it has registered a gatewayUrl via
  // POST /provisioning/register (activateGateway sets both fields atomically).
  //
  // If onboarding completed and called updateProvisioned() before this Stripe
  // webhook arrived, status will be "active" but gatewayUrl will still be null
  // — the container was never launched. In that case we must proceed so the
  // container is actually started.
  if (prov.status === "active" && prov.gatewayUrl !== null) {
    return;
  }

  const webhookUrl = process.env.PROVISIONING_WEBHOOK_URL;
  if (!webhookUrl) {
    // Dev/test: no orchestrator configured. Leave status at "pending" so the
    // state is inspectable and never gets stuck at "provisioning" indefinitely.
    console.log(
      `[provisioning] PROVISIONING_WEBHOOK_URL not set — skipping container launch for user ${params.userId}`,
    );
    return;
  }

  // Advance status to "provisioning" so the UI can show a loading state.
  // Only do this when we are actually about to fire the webhook.
  await provisioningRepo.updateStatus(prov.id, "provisioning");

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
