import type { ApiErrorCode } from "@bnb-marketplace/config";

/**
 * Networking constants for the typed fetch client. No business endpoints are
 * declared here yet — this file only defines the response envelope the future
 * API will conform to.
 */

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  SERVICE_UNAVAILABLE: 503,
} as const;

/** Map an HTTP status to the canonical API error code. */
export function statusToErrorCode(status: number): ApiErrorCode {
  switch (status) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    case 502:
    case 503:
    case 504:
      return "UPSTREAM_ERROR";
    default:
      return "INTERNAL_ERROR";
  }
}

/** Success envelope all API responses are expected to follow. */
export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: { code: ApiErrorCode; message: string; fieldErrors?: Record<string, string[]> };
}
