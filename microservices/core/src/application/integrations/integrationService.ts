import { IntegrationRepository } from "./integrationRepository";
import type { IntegrationMetadata } from "./integrationRepository";
import {
  type SecretsClient,
  buildSecretPath,
  computeKeyHint,
} from "./secretsClient";

export type ConnectResult =
  | { success: true; status: "connected"; keyHint: string; connectedAt: string }
  | { success: false; error: string };

export type RevokeResult =
  | { success: true; status: "revoked" }
  | { success: false; error: string };

const VALID_INTEGRATIONS = [
  "openai",
  "anthropic",
  "elevenlabs",
  "telegram-bot",
  "google",
  "slack",
  "github",
] as const;

export type IntegrationId = (typeof VALID_INTEGRATIONS)[number];

export function isValidIntegrationId(id: string): id is IntegrationId {
  return (VALID_INTEGRATIONS as readonly string[]).includes(id);
}

export class IntegrationService {
  private repo: IntegrationRepository;
  private secrets: SecretsClient;

  constructor(repo: IntegrationRepository, secrets: SecretsClient) {
    this.repo = repo;
    this.secrets = secrets;
  }

  async connect(
    userId: string,
    integrationId: string,
    credential: string,
    label?: string,
  ): Promise<ConnectResult> {
    if (!isValidIntegrationId(integrationId)) {
      return { success: false, error: "Invalid integration ID" };
    }

    if (!credential || credential.trim().length === 0) {
      return { success: false, error: "Credential is required" };
    }

    const secretPath = buildSecretPath(userId, integrationId);
    const keyHint = computeKeyHint(credential);

    // Write secret to Secrets Manager
    await this.secrets.putSecret(secretPath, credential);

    const connectedAt = new Date();

    // Upsert metadata in DB — no plaintext secret stored
    await this.repo.upsert({
      userId,
      integrationId,
      status: "connected",
      keyHint,
      label: label ?? null,
      secretPath,
      connectedAt,
    });

    return {
      success: true,
      status: "connected",
      keyHint,
      connectedAt: connectedAt.toISOString(),
    };
  }

  async list(userId: string): Promise<IntegrationMetadata[]> {
    return this.repo.listByUserId(userId);
  }

  async get(
    userId: string,
    integrationId: string,
  ): Promise<IntegrationMetadata | null> {
    return this.repo.getMetadata(userId, integrationId);
  }

  async revoke(userId: string, integrationId: string): Promise<RevokeResult> {
    const existing = await this.repo.findByUserAndIntegration(
      userId,
      integrationId,
    );

    if (!existing) {
      return { success: false, error: "Integration not found" };
    }

    if (existing.status === "revoked") {
      return { success: false, error: "Integration already revoked" };
    }

    // Delete secret from Secrets Manager
    await this.secrets.deleteSecret(existing.secretPath);

    // Mark as revoked in DB
    await this.repo.markRevoked(existing.id);

    return { success: true, status: "revoked" };
  }
}
