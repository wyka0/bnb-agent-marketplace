import type { ApiErrorCode } from "@bnb-marketplace/config";

/** Error subset understood by the platform's API error envelope. */
export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryable?: boolean;
}

/** An error thrown by the API client that carries a typed code + payload. */
export class ApiClientError extends Error implements ApiErrorPayload {
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string[]>;
  readonly retryable?: boolean;
  readonly status?: number;

  constructor(payload: ApiErrorPayload, status?: number) {
    super(payload.message);
    this.name = "ApiClientError";
    this.code = payload.code;
    this.fieldErrors = payload.fieldErrors;
    this.retryable = payload.retryable;
    this.status = status;
  }

  /** Whether the error can be retried safely (e.g. transient upstream). */
  isRetryable(): boolean {
    return this.retryable === true || this.status === undefined;
  }
}

/** Legacy-shaped alias for callers that prefer a generic Error factory. */
export function isApiError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError;
}

/** Human-readable mapping from codes to operator-facing messages. */
const errorMessages: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "The request is invalid.",
  UNAUTHORIZED: "You are not authenticated.",
  FORBIDDEN: "You do not have access to this resource.",
  NOT_FOUND: "The requested resource could not be found.",
  VALIDATION_ERROR: "Some fields are invalid.",
  CONFLICT: "The request conflicts with the current state.",
  RATE_LIMITED: "Too many requests. Please retry shortly.",
  UPSTREAM_ERROR: "An external service failed.",
  INTERNAL_ERROR: "An unexpected error occurred.",
  STALE_DATA: "The data is temporarily stale. Please refresh.",
};

export function errorMessage(code: ApiErrorCode): string {
  return errorMessages[code];
}
