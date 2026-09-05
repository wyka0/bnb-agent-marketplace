/**
 * TermiX AACP — server-side, READ-ONLY HTTP client (reputation surface only).
 *
 * SCOPE — read-only reputation/agent lookups on BSC Testnet (chain 97):
 *   - GET /api/v1/config                (network + contract addresses; public)
 *   - GET /api/v1/reputation/:agentId   (reputation record; public — NO auth)
 *   - GET /api/v1/agents/:agentId       (agent detail; public — NO auth)
 *
 * INTENTIONALLY ABSENT (documented boundaries, NOT implemented — see the phase
 * scope): job creation/funding/execution, offers, staking, settlement, dispute
 * filing, ANY write endpoint, ANY wallet/signer/private-key handling, ANY
 * on-chain transaction. This module can only issue read-only HTTP GETs.
 *
 * Auth: per authentication.md, `GET /api/v1/*` is PUBLIC. This client sends NO
 * `Authorization`/`Bearer` header and requires NO credential. It never reads a
 * private key, never signs, never mutates.
 *
 * Failure policy: HTTP/network problems NEVER throw to callers — every method
 * returns a discriminated result so the marketplace can render an honest state.
 * Missing data is reported as `not-found`/`unsupported`, NEVER as `score: 0`.
 *
 * No network calls happen at import time.
 */

import {
  TERMIX_AACP_CHAIN_ID,
  TERMIX_AACP_DEFAULT_BASE_URL,
  type TermiXEnvelope,
  type TermiXRawReputation,
} from "./types.js";

/** Minimal `fetch` shape — injectable so verification runs fully offline. */
export type FetchFn = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    cache?: "no-store" | "default" | "reload" | "force-cache" | "only-if-cached";
  }
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export interface TermixClientOptions {
  /** Override the AACP backend base URL (env-driven in production). */
  baseUrl?: string;
  /** Injected fetch (defaults to global `fetch`). */
  fetchFn?: FetchFn;
  /** Bounded request timeout in ms (default 8000). */
  timeoutMs?: number;
}

/** Raw HTTP result before AACP-envelope parsing. */
export type TermixHttpResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      reason:
        | "not-found"
        | "unauthorized"
        | "forbidden"
        | "rate-limited"
        | "bad-request"
        | "server-error"
        | "network-error"
        | "error";
      status?: number;
      message?: string;
    };

const DEFAULT_TIMEOUT_MS = 8000;

/** Resolve the AACP base URL (server-only env override, else the public host). */
export function termixBaseUrl(baseUrl?: string): string {
  const explicit = baseUrl && baseUrl.trim().length > 0 ? baseUrl : undefined;
  const fromEnv = process.env["TERMIX_AACP_BASE_URL"];
  const chosen = explicit ?? (fromEnv && fromEnv.trim().length > 0 ? fromEnv : undefined);
  return (chosen ?? TERMIX_AACP_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function mapStatus(status: number): Exclude<TermixHttpResult<never>, { ok: true }>["reason"] {
  if (status === 400) return "bad-request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server-error";
  return "error";
}

function isAbortLike(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name === "AbortError"
  );
}

/** Type guard: an AACP success envelope carrying an object `data`. */
function isSuccessEnvelope<T>(v: unknown): v is { success: true; data: T } {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { success?: unknown }).success === true &&
    "data" in (v as object) &&
    (v as { data?: unknown }).data != null
  );
}

/** Validate the RAW reputation shape (only fields the API documents). */
export function isRawReputation(v: unknown): v is TermiXRawReputation {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.agentId === "string" &&
    typeof r.score === "number" &&
    typeof r.totalJobs === "number" &&
    typeof r.completedJobs === "number" &&
    typeof r.onTimeJobs === "number" &&
    typeof r.approvedJobs === "number" &&
    typeof r.disputeWins === "number" &&
    typeof r.anomalyFlags === "number"
  );
}

/**
 * A read-only TermiX AACP client. Only GET requests; no auth header; bounded
 * timeout; never throws for HTTP/network problems.
 */
export function createTermixClient(options: TermixClientOptions = {}) {
  const base = termixBaseUrl(options.baseUrl);
  const doFetch: FetchFn = options.fetchFn ?? (globalThis.fetch as unknown as FetchFn);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (typeof doFetch !== "function") {
    throw new Error("TermiX client requires a fetch implementation (none available).");
  }

  /** Issue a bounded, read-only GET and parse the AACP `{success,data}` body. */
  async function getEnvelope<T>(path: string): Promise<TermixHttpResult<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await doFetch(`${base}${path}`, {
        method: "GET",
        // READ-ONLY: public GET per authentication.md. NO Authorization header.
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });

      if (!response.ok) {
        // Try to surface the documented error message without leaking anything.
        let message: string | undefined;
        try {
          const body = (await response.json()) as TermiXEnvelope<never>;
          if (body && body.success === false) message = body.error?.message;
        } catch {
          /* non-JSON error body; keep it generic */
        }
        return { ok: false, reason: mapStatus(response.status), status: response.status, message };
      }

      const body = (await response.json()) as unknown;
      if (isSuccessEnvelope<T>(body)) {
        return { ok: true, data: body.data };
      }
      const message =
        typeof body === "object" && body !== null && "error" in body
          ? (body as { error?: { message?: string } }).error?.message
          : undefined;
      return { ok: false, reason: "error", message };
    } catch (error) {
      if (isAbortLike(error)) {
        return { ok: false, reason: "network-error", message: "request timed out" };
      }
      return { ok: false, reason: "network-error" };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    baseUrl: base,
    chainId: TERMIX_AACP_CHAIN_ID,

    /** `GET /api/v1/reputation/:agentId` — public read. */
    getRawReputation(agentId: string): Promise<TermixHttpResult<TermiXRawReputation>> {
      const id = encodeURIComponent(agentId);
      return getEnvelope<TermiXRawReputation>(`/api/v1/reputation/${id}`);
    },

    /** `GET /api/v1/config` — public read (network + contract addresses). */
    getConfig(): Promise<TermixHttpResult<unknown>> {
      return getEnvelope<unknown>("/api/v1/config");
    },
  };
}

export type TermixClient = ReturnType<typeof createTermixClient>;
