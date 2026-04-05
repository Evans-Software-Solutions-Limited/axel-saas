/**
 * Secrets Manager client abstraction for storing and retrieving integration credentials.
 *
 * In production, this delegates to AWS Secrets Manager via the AWS SDK.
 * The interface is injectable for testing — tests provide a stub implementation.
 *
 * SECURITY: Secret values must never be logged, returned in API responses, or stored in DB.
 */

export interface SecretsClient {
  putSecret(path: string, value: string): Promise<void>;
  deleteSecret(path: string): Promise<void>;
  secretExists(path: string): Promise<boolean>;
}

/**
 * Build the canonical Secrets Manager path for a user integration credential.
 *
 * Pattern: /axel-saas/users/<userId>/integrations/<integrationId>/credential
 */
export function buildSecretPath(userId: string, integrationId: string): string {
  return `/axel-saas/users/${userId}/integrations/${integrationId}/credential`;
}

/**
 * Compute a safe key hint from a credential string.
 * Returns "...XXXX" (last 4 chars) for keys ≥ 8 chars, or "••••" for short keys.
 */
export function computeKeyHint(credential: string): string {
  if (credential.length >= 8) {
    return `...${credential.slice(-4)}`;
  }
  return "••••";
}

/**
 * AWS Secrets Manager implementation.
 *
 * Requires the @aws-sdk/client-secrets-manager package and appropriate IAM permissions.
 * The Lambda function's IAM role must allow secretsmanager:CreateSecret,
 * secretsmanager:PutSecretValue, secretsmanager:DeleteSecret, and
 * secretsmanager:DescribeSecret on the /axel-saas/* path.
 */
export class AwsSecretsClient implements SecretsClient {
  private client:
    | import("@aws-sdk/client-secrets-manager").SecretsManagerClient
    | null = null;

  private async getClient() {
    if (!this.client) {
      const { SecretsManagerClient } =
        await import("@aws-sdk/client-secrets-manager");
      this.client = new SecretsManagerClient({});
    }
    return this.client;
  }

  async putSecret(path: string, value: string): Promise<void> {
    const client = await this.getClient();
    const { PutSecretValueCommand, CreateSecretCommand } =
      await import("@aws-sdk/client-secrets-manager");

    try {
      await client.send(
        new PutSecretValueCommand({
          SecretId: path,
          SecretString: value,
        }),
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        await client.send(
          new CreateSecretCommand({
            Name: path,
            SecretString: value,
          }),
        );
        return;
      }
      throw err;
    }
  }

  async deleteSecret(path: string): Promise<void> {
    const client = await this.getClient();
    const { DeleteSecretCommand } =
      await import("@aws-sdk/client-secrets-manager");

    try {
      await client.send(
        new DeleteSecretCommand({
          SecretId: path,
          ForceDeleteWithoutRecovery: false,
        }),
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return; // Already deleted — idempotent
      }
      throw err;
    }
  }

  async secretExists(path: string): Promise<boolean> {
    const client = await this.getClient();
    const { DescribeSecretCommand } =
      await import("@aws-sdk/client-secrets-manager");

    try {
      await client.send(new DescribeSecretCommand({ SecretId: path }));
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "ResourceNotFoundException") {
        return false;
      }
      throw err;
    }
  }
}
