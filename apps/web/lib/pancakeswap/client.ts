/**
 * PancakeSwap — server-only READ-ONLY pool-data loader (contract + loader).
 *
 * WHY A SERVER LIB (not a route.ts): the app has NO API routes — every page is
 * a server component that calls a lib loader and passes a discriminated result
 * to a client view (the `eight004scan/leaderboard.ts` precedent). The smallest
 * convention-consistent server boundary is therefore a server-only lib consumed
 * by a server component. This module MIRRORS the verified adapter in
 *   packages/integrations/src/pancakeswap/*
 * 1:1. It is NOT a duplication of the integration layer's GraphQL: the web app
 * cannot import `@bnb-marketplace/integrations` (not linked; an install is
 * forbidden in this phase), so this is the established server-only edge shim —
 * exactly how `apps/web/lib/eight004scan/client.ts` mirrors its integration.
 *
 * READ-ONLY. No wallet, no signer, no private key, no transaction, no approval,
 * no Permit2, no Universal Router. The data source is the NodeReal MegaNode
 * PancakeSwap GraphQL (BSC) — authenticated by the server-only env var
 * `PANCAKESWAP_API_KEY` placed in the URL path. The key is ONLY read from
 * `process.env` inside this server module (never from the browser, never
 * `NEXT_PUBLIC_*`), is NEVER logged, and the authenticated URL is never
 * exposed: failures carry status enums + sanitized messages only. Missing key
 * → honest `unauthorized` state before any network call. This module is only
 * imported by server code, so the NodeReal URL is never bundled into the
 * browser. No network calls happen at import time.
 */

import { createApiClient, ApiClientError } from "@bnb-marketplace/data-api";

/* -- Constants + GraphQL query mirrored from packages/integrations/src/pancakeswap/* -- */

/** BSC mainnet — the only chain the read-only pool data source covers. */
export const PANCAKESWAP_BSC_CHAIN_ID = 56 as const;
/** NodeReal MegaNode — the current official BSC V2 source (see P4 doc). */
export const PANCAKESWAP_NODEREAL_BASE_URL = "https://open-platform.nodereal.io" as const;
export const PANCAKESWAP_NODEREAL_FREE_PATH = "pancakeswap-free" as const;
export const PANCAKESWAP_NODEREAL_PREMIUM_PATH = "pancakeswap" as const;
export const PANCAKESWAP_NODEREAL_GRAPHQL_PATH = "graphql" as const;
/** Source tier — Free by default; Premium only when the deployment requires it. */
export type PancakeSwapTier = "free" | "premium";
/**
 * SERVER-ONLY endpoint builder (mirror of the integration adapter). The result
 * contains the API key — never log it and never return it from the loader.
 */
export function buildPancakeSwapEndpoint(apiKey: string, tier: PancakeSwapTier = "free"): string {
  const product =
    tier === "premium" ? PANCAKESWAP_NODEREAL_PREMIUM_PATH : PANCAKESWAP_NODEREAL_FREE_PATH;
  return `${PANCAKESWAP_NODEREAL_BASE_URL}/${apiKey}/${product}/${PANCAKESWAP_NODEREAL_GRAPHQL_PATH}/`;
}

/**
 * SERVER-ONLY credential resolver. `PANCAKESWAP_API_KEY` may be configured in
 * either documented form:
 *   raw:   `PANCAKESWAP_API_KEY=<api key>`            → `base/<key>/<product>/graphql/`
 *   URL:   `PANCAKESWAP_API_KEY=https://.../<key>/<product>/graphql[/]` → used verbatim
 *         (trailing slash normalized). Only the NodeReal base + a known product
 *         path are accepted; anything else is "invalid API key format".
 * Returns null when the value is empty or structurally invalid (the caller maps
 * that to `unauthorized` WITHOUT a network call). The resolved endpoint holds
 * the credential — never log or return it.
 */
export function resolvePancakeSwapEndpoint(
  value: string | undefined,
  tier: PancakeSwapTier = "free"
): string | null {
  const configured = value?.trim();
  if (!configured) return null;
  if (configured.startsWith(`${PANCAKESWAP_NODEREAL_BASE_URL}/`)) {
    const segments = configured
      .slice(PANCAKESWAP_NODEREAL_BASE_URL.length + 1)
      .split("/")
      .filter((s) => s.length > 0);
    const product = segments[1];
    if (
      segments.length >= 3 &&
      (product === PANCAKESWAP_NODEREAL_FREE_PATH || product === PANCAKESWAP_NODEREAL_PREMIUM_PATH)
    ) {
      return configured.endsWith("/") ? configured : `${configured}/`;
    }
    return null;
  }
  if (configured.includes("/")) return null;
  return buildPancakeSwapEndpoint(configured, tier);
}
/** Provenance label for normalized records. */
export const PANCAKESWAP_SOURCE = "pancakeswap" as const;

/** Fixed public GraphQL query (pool fields actually present in the V2 schema). */
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

/* -- RAW subgraph types (Graph-Node: BigDecimal == string, BigInt == string) -- */

export interface PcsRawToken {
  id: string;
  symbol: string;
  name?: string;
}

export interface PcsRawPair {
  id: string;
  name?: string;
  token0: PcsRawToken;
  token1: PcsRawToken;
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  reserveBNB?: string;
  token0Price: string;
  token1Price: string;
  /** Cumulative lifetime volume, USD — NOT 24h. */
  volumeUSD: string;
  untrackedVolumeUSD?: string;
  totalTransactions: string;
}

/* -- Normalized application shape (server-safe, serializable) -- */

export interface PancakeSwapPool {
  poolId: string;
  chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
  token0Address: string;
  token0Symbol: string;
  token1Address: string;
  token1Symbol: string;
  /** Convenience "WBNB/CAKE" label. */
  symbol: string;
  /** Total value locked (reserveUSD), USD. */
  tvlUsd: number;
  /** CUMULATIVE lifetime volume, USD — NOT 24h. */
  volumeUsd: number;
  token0Price: number;
  token1Price: number;
  /** Cumulative swaps count. */
  totalTransactions: number;
  /** NOT provided by the V2 subgraph → always null (never fabricated). */
  apr: number | null;
  apy: number | null;
  source: typeof PANCAKESWAP_SOURCE;
  retrievedAt: string;
}

/** Honest failure/absence states — the UI switches on these (never a fake 0). */
export type PancakeSwapState =
  | "ready"
  | "not-found"
  | "bad-request"
  | "unauthorized"
  | "forbidden"
  | "rate-limited"
  | "server-error"
  | "network-error"
  | "timeout"
  | "error";

/**
 * Loader result. `state:"ready"` carries normalized pools; every other state is
 * an honest failure/absence. Never turns errors into empty success or zeros.
 */
export type PancakeSwapPoolsData =
  | {
      state: "ready";
      pools: PancakeSwapPool[];
      source: typeof PANCAKESWAP_SOURCE;
      chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
      retrievedAt: string;
    }
  | {
      state: Exclude<PancakeSwapState, "ready">;
      pools: [];
      source: typeof PANCAKESWAP_SOURCE;
      chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
      retrievedAt: string;
      reason: Exclude<PancakeSwapState, "ready">;
      message?: string;
    };

/* -- Normalization helpers (mirroring the verified integration adapter) -- */

function parseDecimal(v: unknown): number | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isValidToken(v: unknown): v is PcsRawToken {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return typeof t.id === "string" && typeof t.symbol === "string";
}

/** A raw pair row is usable only if every required field parses to a real number. */
export function isValidRawPair(v: unknown): v is PcsRawPair {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    isValidToken(p.token0) &&
    isValidToken(p.token1) &&
    parseDecimal(p.reserveUSD) !== null &&
    parseDecimal(p.volumeUSD) !== null &&
    parseDecimal(p.token0Price) !== null &&
    parseDecimal(p.token1Price) !== null &&
    parseDecimal(p.totalTransactions) !== null
  );
}

/** Normalize one validated raw pair; returns null (dropped) if invalid. Never fabricates zeros. */
export function normalizePair(raw: unknown): PancakeSwapPool | null {
  if (!isValidRawPair(raw)) return null;
  const t0 = raw.token0;
  const t1 = raw.token1;
  return {
    poolId: raw.id,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    token0Address: t0.id,
    token0Symbol: t0.symbol,
    token1Address: t1.id,
    token1Symbol: t1.symbol,
    symbol: `${t0.symbol}/${t1.symbol}`,
    tvlUsd: parseDecimal(raw.reserveUSD)!,
    volumeUsd: parseDecimal(raw.volumeUSD)!, // cumulative, NOT 24h
    token0Price: parseDecimal(raw.token0Price)!,
    token1Price: parseDecimal(raw.token1Price)!,
    totalTransactions: parseDecimal(raw.totalTransactions)!,
    apr: null, // V2 subgraph provides no APR — never fabricate
    apy: null,
    source: PANCAKESWAP_SOURCE,
    retrievedAt: new Date().toISOString(),
  };
}

/** Normalize a batch. Invalid rows are dropped. */
export function normalizePairs(rawList: unknown[]): PancakeSwapPool[] {
  const out: PancakeSwapPool[] = [];
  for (const raw of rawList) {
    const n = normalizePair(raw);
    if (n !== null) out.push(n);
  }
  return out;
}

/* -- Graph envelope parsing -- */

interface GraphEnvelope {
  data?: { pairs?: unknown };
  errors?: { message?: string }[];
}

function mapStatusToState(status: number): Exclude<PancakeSwapState, "ready"> {
  if (status === 400) return "bad-request";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 429) return "rate-limited";
  if (status >= 500) return "server-error";
  return "error";
}

/** True when the error is a request timeout/abort. */
function isTimeoutLike(error: unknown): boolean {
  // Raw fetch AbortError (defensive) OR data-api's typed timeout (UPSTREAM_ERROR,
  // message "Request timed out", no status). Both mean "timed out" → timeout.
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (typeof error === "object" && error !== null) {
    const e = error as { name?: unknown; message?: unknown; code?: unknown; status?: unknown };
    if (e.name === "AbortError") return true;
    if (e.code === "UPSTREAM_ERROR" && e.status === undefined) return true;
  }
  return false;
}

const EMPTY_BASE = {
  pools: [] as [],
  source: PANCAKESWAP_SOURCE,
  chainId: PANCAKESWAP_BSC_CHAIN_ID,
};

/** Options for the read-only pools call. */
export interface GetPancakeSwapPoolsOptions {
  limit?: number;
  orderBy?: "volumeUSD" | "reserveUSD" | "totalTransactions";
  /** Bounded per-request timeout (ms, default 10000). */
  timeoutMs?: number;
  /** Source tier — defaults to the Free package (200 queries/day). */
  tier?: PancakeSwapTier;
}

/** Server-only env var name (never NEXT_PUBLIC_*); value is never read aloud. */
const PANCAKESWAP_API_KEY_ENV = "PANCAKESWAP_API_KEY" as const;

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

/** One bounded GraphQL POST via the data-api client; never throws. */
async function postPairQuery(
  endpoint: string,
  first: number,
  orderBy: string,
  orderDir: "asc" | "desc",
  timeoutMs: number
): Promise<{ ok: true; body: GraphEnvelope } | { ok: false; status?: number; timeout?: boolean }> {
  const client = createApiClient({ baseUrl: endpoint, timeoutMs });
  try {
    const body = await client.post<GraphEnvelope>(
      "",
      { query: PAIRS_QUERY, variables: { first, orderBy, orderDir } },
      { forceLiterally: true, cache: "no-store" }
    );
    return { ok: true, body };
  } catch (error) {
    if (isTimeoutLike(error)) return { ok: false, timeout: true };
    const status = (error as ApiClientError)?.status;
    return { ok: false, status: typeof status === "number" ? status : undefined };
  }
}

/**
 * READ-ONLY: fetch + normalize top PancakeSwap pools from the official
 * NodeReal source (server-only key from `PANCAKESWAP_API_KEY`). Always resolves
 * (never throws) so the page renders an honest state in every case. A
 * PancakeSwap failure NEVER breaks the rest of the marketplace. The key and the
 * authenticated URL never appear in any returned message. Empty pairs →
 * `not-found`; malformed/GraphQL errors → `error`; timeouts map to `timeout`
 * (state) with `reason: "network-error"`. Missing data is NEVER a 0.
 */
export async function getPancakeSwapPools(
  options: GetPancakeSwapPoolsOptions = {}
): Promise<PancakeSwapPoolsData> {
  const orderBy = options.orderBy ?? "volumeUSD";
  const first = Math.min(Math.max(options.limit ?? 5, 1), 20);
  const timeoutMs = options.timeoutMs ?? 10_000;
  const configured = process.env[PANCAKESWAP_API_KEY_ENV];

  if (!configured || configured.length === 0) {
    return {
      ...EMPTY_BASE,
      state: "unauthorized",
      retrievedAt: new Date().toISOString(),
      reason: "unauthorized",
      message: "PANCAKESWAP_API_KEY is not configured",
    };
  }
  // SERVER-ONLY: accepts a raw key OR the full keyed NodeReal URL; the resolved
  // endpoint holds the credential and is never returned/logged.
  const endpoint = resolvePancakeSwapEndpoint(configured, options.tier ?? "free");
  if (!endpoint) {
    return {
      ...EMPTY_BASE,
      state: "unauthorized",
      retrievedAt: new Date().toISOString(),
      reason: "unauthorized",
      message: "invalid API key format",
    };
  }
  const apiKey = configured;

  const firstPass = await postPairQuery(endpoint, first, orderBy, "desc", timeoutMs);
  if (!firstPass.ok) {
    if (firstPass.timeout)
      return {
        ...EMPTY_BASE,
        state: "timeout",
        retrievedAt: new Date().toISOString(),
        reason: "timeout",
        message: "request timed out",
      };
    if (typeof firstPass.status === "number") {
      const reason = mapStatusToState(firstPass.status);
      return { ...EMPTY_BASE, state: reason, retrievedAt: new Date().toISOString(), reason };
    }
    return {
      ...EMPTY_BASE,
      state: "network-error",
      retrievedAt: new Date().toISOString(),
      reason: "network-error",
      message: "network failure",
    };
  }

  const raw = firstPass.body;
  if (raw.errors && raw.errors.length > 0) {
    const message = sanitizeMessage(raw.errors[0]?.message, apiKey);
    if (isUnsupportedOrderBy(message)) {
      // BETA fallback (single bounded retry): order by the documented key, then
      // re-rank client-side over the BETA top-1000 (honest measured fields).
      const cap = Math.min(1000, Math.max(first * 4, 50));
      const fallback = await postPairQuery(endpoint, cap, "trackedReserveBNB", "desc", timeoutMs);
      if (!fallback.ok) {
        if (fallback.timeout)
          return {
            ...EMPTY_BASE,
            state: "timeout",
            retrievedAt: new Date().toISOString(),
            reason: "timeout",
            message: "request timed out",
          };
        if (typeof fallback.status === "number") {
          const reason = mapStatusToState(fallback.status);
          return { ...EMPTY_BASE, state: reason, retrievedAt: new Date().toISOString(), reason };
        }
        return {
          ...EMPTY_BASE,
          state: "network-error",
          retrievedAt: new Date().toISOString(),
          reason: "network-error",
          message: "network failure",
        };
      }
      const fbErrors = fallback.body.errors;
      if (fbErrors && fbErrors.length > 0) {
        const fbMessage = sanitizeMessage(fbErrors[0]?.message, apiKey);
        return {
          ...EMPTY_BASE,
          state: "server-error",
          retrievedAt: new Date().toISOString(),
          reason: "server-error",
          message: fbMessage ?? "GraphQL error",
        };
      }
      const fbPairs = fallback.body.data?.pairs;
      if (!Array.isArray(fbPairs)) {
        return {
          ...EMPTY_BASE,
          state: "server-error",
          retrievedAt: new Date().toISOString(),
          reason: "server-error",
          message: "unexpected response shape (no pairs)",
        };
      }
      if (fbPairs.length === 0) {
        return {
          ...EMPTY_BASE,
          state: "not-found",
          retrievedAt: new Date().toISOString(),
          reason: "not-found",
        };
      }
      const ranked = normalizePairs(fbPairs);
      if (ranked.length === 0) {
        return {
          ...EMPTY_BASE,
          state: "server-error",
          retrievedAt: new Date().toISOString(),
          reason: "server-error",
          message: "no pools could be parsed",
        };
      }
      const rankKey: "tvlUsd" | "volumeUsd" | "totalTransactions" =
        orderBy === "reserveUSD"
          ? "tvlUsd"
          : orderBy === "totalTransactions"
            ? "totalTransactions"
            : "volumeUsd";
      ranked.sort((a, b) => b[rankKey] - a[rankKey]);
      const pools = ranked.slice(0, first);
      return {
        state: "ready",
        pools,
        source: PANCAKESWAP_SOURCE,
        chainId: PANCAKESWAP_BSC_CHAIN_ID,
        retrievedAt: pools[0]?.retrievedAt ?? new Date().toISOString(),
      };
    }
    return {
      ...EMPTY_BASE,
      state: "server-error",
      retrievedAt: new Date().toISOString(),
      reason: "server-error",
      message: message ?? "GraphQL error",
    };
  }
  const pairs = raw.data?.pairs;
  if (!Array.isArray(pairs)) {
    return {
      ...EMPTY_BASE,
      state: "server-error",
      retrievedAt: new Date().toISOString(),
      reason: "server-error",
      message: "unexpected response shape (no pairs)",
    };
  }
  if (pairs.length === 0) {
    return {
      ...EMPTY_BASE,
      state: "not-found",
      retrievedAt: new Date().toISOString(),
      reason: "not-found",
    };
  }

  const pools = normalizePairs(pairs);
  if (pools.length === 0) {
    return {
      ...EMPTY_BASE,
      state: "server-error",
      retrievedAt: new Date().toISOString(),
      reason: "server-error",
      message: "no pools could be parsed",
    };
  }
  return {
    state: "ready",
    pools,
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt: pools[0]!.retrievedAt,
  };
}
