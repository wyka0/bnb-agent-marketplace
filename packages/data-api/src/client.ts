import type { ApiErrorCode } from "@bnb-marketplace/config";
import type { ApiEnvelope } from "./types.js";
import { ApiClientError, type ApiErrorPayload } from "./errors.js";

/** Options accepted by every request method. */
export interface FetchRequestOptions {
  headers?: HeadersInit;
  timeoutMs?: number;
  /** Parse response body directly instead of unwrapping the envelope. */
  forceLiterally?: boolean;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  body?: BodyInit;
}

interface InternalRequestOptions extends FetchRequestOptions {
  method?: string;
}

export interface ApiClientConfig {
  baseUrl: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

// A discriminated union for HTTP-derived API error codes.
type LocalErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR"
  | "STALE_DATA";

export type { LocalErrorCode };

function statusToCode(status: number): ApiErrorCode {
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
    case 422:
      return "VALIDATION_ERROR";
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

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function parseResponse<T>(response: Response, forceLiterally?: boolean): Promise<T> {
  const status = response.status;

  if (!response.ok) {
    let payload: ApiErrorPayload = {
      code: statusToCode(status),
      message: `Request failed with status ${status}`,
      retryable: status >= 500 || status === 429,
    };
    try {
      const body = (await response.json()) as Partial<ApiEnvelope<never>>;
      if (body.error) {
        payload = {
          code: body.error.code,
          message: body.error.message ?? payload.message,
          fieldErrors: body.error.fieldErrors,
          retryable: status >= 500 || status === 429,
        };
      }
    } catch {
      /* non-JSON error body; keep the generic payload */
    }
    throw new ApiClientError(payload, status);
  }

  if (forceLiterally) {
    return (await response.json()) as T;
  }

  const envelope = (await response.json()) as ApiEnvelope<T>;
  if (envelope.ok === false || envelope.error) {
    throw new ApiClientError(
      {
        code: envelope.error?.code ?? "INTERNAL_ERROR",
        message: envelope.error?.message ?? "Request failed",
        fieldErrors: envelope.error?.fieldErrors,
        retryable: status >= 500 || status === 429,
      },
      status
    );
  }
  return envelope.data as T;
}

/** Factory for a typed HTTP client bound to one base URL. Endpoint-less for now. */
export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, fetchFn = fetch, timeoutMs = 10_000 } = config;

  async function request<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
    const { forceLiterally, timeoutMs: perTimeout = timeoutMs, method = "GET", ...rest } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), perTimeout);
    const headers = new Headers(rest.headers);
    if (rest.body && !headers.has("Content-Type") && typeof rest.body === "string") {
      headers.set("Content-Type", "application/json");
    }

    try {
      const response = await fetchFn(`${baseUrl}${path}`, {
        ...rest,
        method,
        headers,
        signal: controller.signal,
      });
      return await parseResponse<T>(response, Boolean(forceLiterally));
    } catch (error) {
      if (isAbortError(error)) {
        throw new ApiClientError({
          code: "UPSTREAM_ERROR",
          message: "Request timed out",
          retryable: true,
        });
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: <T>(path: string, options?: FetchRequestOptions) =>
      request<T>(path, { method: "GET", ...options }),
    post: <T>(path: string, body: unknown, options?: FetchRequestOptions) =>
      request<T>(path, { method: "POST", body: JSON.stringify(body), ...options }),
    put: <T>(path: string, body: unknown, options?: FetchRequestOptions) =>
      request<T>(path, { method: "PUT", body: JSON.stringify(body), ...options }),
    patch: <T>(path: string, body: unknown, options?: FetchRequestOptions) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body), ...options }),
    delete: <T>(path: string, options?: FetchRequestOptions) =>
      request<T>(path, { method: "DELETE", ...options }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
