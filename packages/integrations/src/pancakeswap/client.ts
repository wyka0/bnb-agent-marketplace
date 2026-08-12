/**
 * PancakeSwap — server-side, READ-ONLY HTTP client (V2 Exchange data, NodeReal
 * MegaNode PancakeSwap GraphQL).
 *
 * SCOPE — read-only pool data on BSC mainnet (chain 56):
 *   - GraphQL query of the official PancakeSwap V2 Exchange data source
 *     (NodeReal MegaNode, the source currently linked by the official docs).
 *   - No `@pancakeswap/*` package is added — GraphQL over plain HTTP, so no
 *     install is required (smallest footprint). The Price-API SDK / Smart
 *     Router are packages and would add execution-adjacent surface; not used.
 *
 * INTENTIONALLY ABSENT (documented boundaries, NOT implemented): swaps,
 * liquidity deposits/withdrawals, token approvals, Permit2, Universal Router
 * calls, market making, staking, settlement, ANY wallet/signer/private-key/tx.
 * This module can only issue a read-only GraphQL POST of a fixed public query.
 *
 * Auth: the NodeReal endpoint is authenticated with the API key in the URL
 * path (`{base}/{API-KEY}/{product}/graphql`) — the key is NEVER sent in an
 * Authorization header, NEVER logged, NEVER included in returned errors, and
 * the authenticated URL is NEVER exposed (callers only ever receive status /
 * failure enums and sanitized messages). Miss the key → `unauthorized` before
 * any network call.
 *
 * Schema note (NodeReal BETA): the current official schema advertises
 * `Pair_orderBy: [trackedReserveBNB]` only. The default request keeps the
 * documented PAIRS_QUERY ordering; if the source rejects the requested
 * orderBy (GraphQL error mentioning orderBy), ONE bounded fallback request
 * orders by `trackedReserveBNB` and re-ranks the returned rows client-side by
 * the requested key (no polling, no refresh loop — a single retry).
 *
 * Failure policy: HTTP / network / GraphQL errors NEVER throw to callers —
 * every method returns a discriminated result. Missing pairs → `not-found`,
 * NOT a fabricated `0` TVL/volume/price. No network calls at import time.
 *
 * The mainnet chain here is READ-ONLY data only; this module never submits a
 * transaction and can never move funds.
 */

import {
  PANCAKESWAP_NODEREAL_BASE_URL,
  buildPancakeSwapEndpoint,
  type ListPoolsOptions,
  type PancakeSwapFailure,
  type PancakeSwapPool,
  type PancakeSwapPoolResult,
} from "./types.js";
import { normalizePairs } from "./pools.js";

/** Standard Graph Node response envelope. */
interface GraphResponse {
  data?: unknown;
  errors?: { message?: string }[];
}

/** Fixed public GraphQL query (pool fields actually present in the schema). */
export const PAIRS_QUERY = `
  query TopPairs($first: Int!, $orderBy: String!, $orderDir: String!) {
    pairs(first: $first, orderBy: $orderBy, orderDirection: $orderDir) {
      id
      name
      token0 { id symbol name }
      token1 { id symbol name }
      reserve0
      reserve1
      reserveUSD
      reserveBNB
      token0Price
      token1Price
      volumeUSD
      untrackedVolumeUSD
      totalTransactions
    }
  }
` as const;

const ORDER_VAR: Record<NonNullable<ListPoolsOptions["orderBy"]>, string> = {
  volumeUSD: "volumeUSD",
  reserveUSD: "reserveUSD",
  totalTransactions: "totalTransactions",
};

/** Client-side ranking key used by the BETA `trackedReserveBNB` fallback. */
const RANK_KEY: Record<
  NonNullable<ListPoolsOptions["orderBy"]>,
  keyof Pick<PancakeSwapPool, "tvlUsd" | "volumeUsd" | "totalTransactions">
> = {
  volumeUSD: "volumeUsd",
  reserveUSD: "tvlUsd",
  totalTransactions: "totalTransactions",
};

/**
 * Strip the NodeReal API key and the NodeReal host from any message so errors
 * can never leak the credential or the authenticated URL.
 */
function sanitizeMessage(message: string | undefined, apiKey: string): string | undefined {
  if (!message) return message;
  let safe = message;
  if (apiKey.length > 0) safe = safe.split(apiKey).join("[REDACTED]");
  return safe.split(PANCAKESWAP_NODEREAL_BASE_URL).join("[REDACTED-URL]");
}

/** True when the source rejected the requested orderBy (BETA schema rule). */
function isUnsupportedOrderBy(message: string | undefined): boolean {
  return typeof message === "string" && /order.?by/i.test(message);
}

/** One bounded GraphQL POST; returns the raw body on success (2xx + JSON). */
async function postQuery(
  PcsFetchFn: PcsFetchFn,
  endpoint: string,
  first: number,
  orderBy: string,
  orderDir: "asc" | "desc",
  timeoutMs: number
): Promise<
  | { ok: true; body: GraphResponse }
  | { ok: false; failure: Extract<PancakeSwapPoolResult, { ok: false }> }
> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await PcsFetchFn(endpoint, {
      method: "POST",
      // READ-ONLY: the API key lives in the URL path — never an Authorization header.
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        query: PAIRS_QUERY,
        variables: { first, orderBy, orderDir },
      }),
    });

    if (!response.ok) {
      return {
        ok: false,
        failure: { ok: false, reason: mapStatus(response.status), status: response.status },
      };
    }

    let body: GraphResponse;
    try {
      body = (await response.json()) as GraphResponse;
    } catch {
      return {
        ok: false,
        failure: { ok: false, reason: "error", message: "unparseable JSON body" },
      };
    }
    return { ok: true, body };
  } catch (error) {
    if (isAbortLike(error)) {
      return {
        ok: false,
        failure: { ok: false, reason: "network-error", message: "request timed out" },
      };
    }
    return { ok: false, failure: { ok: false, reason: "network-error" } };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * READ-ONLY: list top pools from the official NodeReal PancakeSwap source.
 * Requires `options.apiKey` (server-only). Never throws for HTTP/network/GraphQL
 * problems; returns a discriminated result. The key and the authenticated URL
 * never appear in any returned message.
 */
export async function listPools(
  PcsFetchFn: PcsFetchFn = globalThis.fetch as unknown as PcsFetchFn,
  options: ListPoolsOptions = {}
): Promise<PancakeSwapPoolResult> {
  const apiKey = options.apiKey;
  if (!apiKey || apiKey.length === 0) {
    return { ok: false, reason: "unauthorized", message: "PANCAKESWAP_API_KEY is not configured" };
  }
  if (apiKey.includes("/")) {
    return { ok: false, reason: "unauthorized", message: "invalid API key format" };
  }
  // SERVER-ONLY: the built URL contains the API key and is never returned/logged.
  const endpoint = buildPancakeSwapEndpoint(apiKey, options.tier ?? "free");
  const first = Math.max(1, Math.min(100, options.limit ?? 10));
  const orderBy = ORDER_VAR[options.orderBy ?? "volumeUSD"];
  const timeoutMs = options.timeoutMs ?? 10_000;

  const result = await postQuery(PcsFetchFn, endpoint, first, orderBy, "desc", timeoutMs);
  if (!result.ok) return result.failure;
  const body = result.body;

  if (body.errors && body.errors.length > 0) {
    const message = sanitizeMessage(body.errors[0]?.message, apiKey);
    if (isUnsupportedOrderBy(message)) {
      // BETA fallback (single bounded retry): the source rejects the requested
      // sort → order by the documented key, then re-rank client-side. The
      // ranking is honest (real measured fields), bounded to the BETA top-1000.
      const cap = Math.min(1000, Math.max(first * 4, 50));
      const fallback = await postQuery(
        PcsFetchFn,
        endpoint,
        cap,
        "trackedReserveBNB",
        "desc",
        timeoutMs
      );
      if (!fallback.ok) return fallback.failure;
      const fbBody = fallback.body;
      if (fbBody.errors && fbBody.errors.length > 0) {
        return {
          ok: false,
          reason: "error",
          message: sanitizeMessage(fbBody.errors[0]?.message, apiKey),
        };
      }
      const fbData = fbBody.data;
      if (typeof fbData !== "object" || fbData === null || !("pairs" in fbData)) {
        return { ok: false, reason: "error", message: "unexpected response shape (no pairs)" };
      }
      const fbPairs = (fbData as { pairs: unknown }).pairs;
      if (!Array.isArray(fbPairs)) {
        return { ok: false, reason: "error", message: "unexpected pairs field (not an array)" };
      }
      if (fbPairs.length === 0) {
        return { ok: false, reason: "not-found", message: "no pools matched the query" };
      }
      const normalized = normalizePairs(fbPairs);
      if (normalized.length === 0) {
        return { ok: false, reason: "error", message: "no pools could be parsed" };
      }
      const rank = RANK_KEY[options.orderBy ?? "volumeUSD"];
      normalized.sort((a, b) => b[rank] - a[rank]);
      return { ok: true, data: normalized.slice(0, first) };
    }
    return { ok: false, reason: "error", message };
  }

  const data = body.data;
  if (typeof data !== "object" || data === null || !("pairs" in data)) {
    return { ok: false, reason: "error", message: "unexpected response shape (no pairs)" };
  }
  const pairs = (data as { pairs: unknown }).pairs;
  if (!Array.isArray(pairs)) {
    return { ok: false, reason: "error", message: "unexpected pairs field (not an array)" };
  }
  if (pairs.length === 0) {
    return { ok: false, reason: "not-found", message: "no pools matched the query" };
  }

  const normalized = normalizePairs(pairs);
  if (normalized.length === 0) {
    // Rows were present but none were parseable — surface an honest error
    // rather than fabricating zeros or a misleadingly-empty success.
    return { ok: false, reason: "error", message: "no pools could be parsed" };
  }
  return { ok: true, data: normalized };
}

/* --------------------------------------------------------------------------
 * Small helpers shared with the verify harness (kept internal, not exported
 * from the barrel).
 * ------------------------------------------------------------------------ */

function mapStatus(status: number): PancakeSwapFailure {
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

/** Minimal `fetch` shape — injectable so verification runs fully offline. */
export type PcsFetchFn = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    body?: unknown;
  }
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
