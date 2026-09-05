/**
 * PancakeSwap — typed response contract (READ-ONLY data surface).
 *
 * Types transcribed EXACTLY from the authoritative PancakeSwap V2 Exchange
 * subgraph schema (`pancakeswap/pancake-subgraph`, branch `v2`,
 * `subgraphs/exchange/schema.graphql`) — the official read-only source for BSC
 * mainnet pool data. No fields are invented; every property below maps to a
 * real `Pair`/`Token` field. Notably the V2 schema has NO on-chain `apr`/`apy`
 * — so those are `null` in the normalized shape (never fabricated).
 *
 * Response envelope: The Graph Node standard `{ data: T }`, optionally with an
 * `errors: [{ message }]` array on query failure.
 */

/** BSC mainnet — the only chain the read-only pool data source covers. */
export const PANCAKESWAP_BSC_CHAIN_ID = 56 as const;

/**
 * NodeReal MegaNode — PancakeSwap GraphQL (the CURRENT official BSC V2 source,
 * linked from developer.pancakeswap.finance → APIs → Subgraph → Exchange V2).
 * The previous public subgraph (bsc.streamingfast.io) is decommissioned (404).
 *
 * Endpoint shape (NodeReal reference docs): `{base}/{API-KEY}/{product}/graphql`
 * Product paths: "pancakeswap-free" (Free, 200 queries/day) and "pancakeswap"
 * (Premium, 20,000 queries/day). The key is a URL path segment — NEVER log the
 * full URL and NEVER expose it client-side.
 */
export const PANCAKESWAP_NODEREAL_BASE_URL = "https://open-platform.nodereal.io" as const;
export const PANCAKESWAP_NODEREAL_FREE_PATH = "pancakeswap-free" as const;
export const PANCAKESWAP_NODEREAL_PREMIUM_PATH = "pancakeswap" as const;
export const PANCAKESWAP_NODEREAL_GRAPHQL_PATH = "graphql" as const;

/** Source tier — Free by default; Premium only when the deployment requires it. */
export type PancakeSwapTier = "free" | "premium";

/**
 * Build the authenticated NodeReal endpoint (SERVER-SIDE ONLY — the result
 * contains the API key and must never reach a browser, logs, or errors).
 * Trailing slash per the official NodeReal endpoint example.
 */
export function buildPancakeSwapEndpoint(apiKey: string, tier: PancakeSwapTier = "free"): string {
  const product =
    tier === "premium" ? PANCAKESWAP_NODEREAL_PREMIUM_PATH : PANCAKESWAP_NODEREAL_FREE_PATH;
  return `${PANCAKESWAP_NODEREAL_BASE_URL}/${apiKey}/${product}/${PANCAKESWAP_NODEREAL_GRAPHQL_PATH}/`;
}

/** Provenance label for normalized records. */
export const PANCAKESWAP_SOURCE = "pancakeswap" as const;
export type PancakeSwapSource = typeof PANCAKESWAP_SOURCE;

/* --------------------------------------------------------------------------
 * RAW subgraph types — EXACT Pair/Token fields. Prefixed `PcsRaw*`.
 * ------------------------------------------------------------------------ */

/** `Token` entity (only the fields we select). */
export interface PcsRawToken {
  /** Contract address (hex). */
  id: string;
  /** Token symbol, e.g. "WBNB". */
  symbol: string;
  /** Token name. */
  name: string;
}

/**
 * Raw `Pair` record as selected by `PAIRS_QUERY`. Every field is documented in
 * the exchange schema. Numeric amounts are decimals as STRINGS (BigDecimal).
 */
export interface PcsRawPair {
  /** Pair contract address (hex). */
  id: string;
  /** Pair display name (schema `name`). */
  name: string;
  token0: PcsRawToken;
  token1: PcsRawToken;
  /** Reserve of token0 (decimal string). */
  reserve0: string;
  /** Reserve of token1 (decimal string). */
  reserve1: string;
  /** Derived total liquidity in USD (decimal string). */
  reserveUSD: string;
  /** Derived liquidity in BNB (decimal string). */
  reserveBNB: string;
  /** Price of token0 denominated in token1 (decimal string). */
  token0Price: string;
  /** Price of token1 denominated in token0 (decimal string). */
  token1Price: string;
  /** Lifetime cumulative volume, USD (decimal string). */
  volumeUSD: string;
  /** Less-confident cumulative volume, USD (decimal string). */
  untrackedVolumeUSD: string;
  /** Lifetime cumulative swaps count (decimal string). */
  totalTransactions: string;
}

/* --------------------------------------------------------------------------
 * NORMALIZED application representation — honest, read-only, never fabricated.
 * ------------------------------------------------------------------------ */

/**
 * Normalized PancakeSwap pool (V2 pair). Only fields the official subgraph
 * supports. A missing/unavailable lookup is NEVER represented as zero; callers
 * get a discriminated result instead. `apr`/`apy` are `null` because the
 * official V2 subgraph does not provide them — they are never invented.
 */
export interface PancakeSwapPool {
  /** Pair/pool contract address. */
  poolId: string;
  /** BSC mainnet chain id (56). */
  chainId: typeof PANCAKESWAP_BSC_CHAIN_ID;
  token0Address: string;
  token0Symbol: string;
  token1Address: string;
  token1Symbol: string;
  /** Convenience "WBNB/CAKE" label from the two on-chain symbols. */
  symbol: string;
  /** Total value locked (reserveUSD), USD — number. */
  tvlUsd: number;
  /** Cumulative lifetime volume, USD. NOT a 24h figure (V2 schema). */
  volumeUsd: number;
  /** Price of token0 in terms of token1. */
  token0Price: number;
  /** Price of token1 in terms of token0. */
  token1Price: number;
  /** Lifetime cumulative swaps count. */
  totalTransactions: number;
  /** NOT provided by the V2 subgraph → always null (never fabricated). */
  apr: number | null;
  /** NOT provided by the V2 subgraph → always null (never fabricated). */
  apy: number | null;
  /** Provenance label. */
  source: PancakeSwapSource;
  /** ISO time the lookup was performed (client clock). */
  retrievedAt: string;
}

/** Discriminated failure/absence reasons — honest, never a fabricated zero. */
export type PancakeSwapFailure =
  | "not-found" // no pair matched the query
  | "bad-request" // 400
  | "unauthorized" // 401
  | "forbidden" // 403
  | "rate-limited" // 429
  | "server-error" // 5xx
  | "network-error" // fetch failed / timeout / abort
  | "unsupported" // query/field not supported by the source
  | "error"; // malformed body / GraphQL errors / unexpected shape

/** Read-only lookup result. Missing data is NEVER a fabricated number. */
export type PancakeSwapPoolResult =
  | { ok: true; data: PancakeSwapPool[] }
  | { ok: false; reason: PancakeSwapFailure; status?: number; message?: string };

/** Options accepted by the read-only list call. */
export interface ListPoolsOptions {
  /** NodeReal MegaNode API key (server-only). Required — the endpoint is keyed. */
  apiKey?: string;
  /** Source tier — defaults to the Free package (200 queries/day). */
  tier?: PancakeSwapTier;
  /** Max results (default 10). */
  limit?: number;
  /** Order field — defaults to lifetime volume (documented subgraph field). */
  orderBy?: "volumeUSD" | "reserveUSD" | "totalTransactions";
  /** Bounded per-request timeout (ms, default 10000). */
  timeoutMs?: number;
}
