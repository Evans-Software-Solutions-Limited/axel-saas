/**
 * Shared helpers for parsing API responses and extracting error messages.
 * Used by chatApi.ts and onboardingApi.ts.
 */

interface ApiErrorLike {
  status?: number;
  message?: string;
  value?: unknown;
}

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const getErrorMessage = (value: unknown): string | undefined => {
  if (!isObject(value)) return undefined;
  const message = value["error"];
  return typeof message === "string" ? message : undefined;
};

export const getResponseError = (value: unknown): ApiErrorLike | undefined => {
  if (!isObject(value)) return undefined;
  const errorValue = value["error"];
  return isObject(errorValue) ? (errorValue as ApiErrorLike) : undefined;
};

export const getStatusCode = (value: unknown): number | undefined => {
  if (!isObject(value)) return undefined;

  const topLevelStatus = value["status"];
  if (typeof topLevelStatus === "number") return topLevelStatus;

  const nestedError = value["error"];
  if (isObject(nestedError) && typeof nestedError["status"] === "number") {
    return nestedError["status"];
  }

  return undefined;
};

export type { ApiErrorLike };
