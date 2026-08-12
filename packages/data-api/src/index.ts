/**
 * @bnb-marketplace/data-api — typed HTTP client, response envelope, and error
 * handling. No business endpoints yet; this is the foundation on which the
 * catalog/hire/monitoring APIs will be built.
 */

export { createApiClient } from "./client.js";
export type { ApiClient, ApiClientConfig, FetchRequestOptions } from "./client.js";
export { ApiClientError, isApiError, errorMessage } from "./errors.js";
export type { ApiErrorPayload } from "./errors.js";
export { HTTP_STATUS, statusToErrorCode } from "./types.js";
export type { ApiEnvelope } from "./types.js";
