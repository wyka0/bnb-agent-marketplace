/**
 * PancakeSwap — READ-ONLY data surface.
 *
 * Public barrel for the read-only pool/liquidity data adapter. It queries the
 * official PancakeSwap V2 Exchange subgraph (GraphQL) over plain HTTP — no
 * `@pancakeswap/*` package, no wallet, no signer, no private key, no
 * transaction, no swaps / liquidity / approvals / Permit2 / Universal Router.
 *
 * The legacy LP-optimization interface below is retained ONLY as an explicit,
 * NOT-IMPLEMENTED placeholder for a future execution-capable adapter; no
 * execution path exists in this phase.
 */

import type { ChainId } from "@bnb-marketplace/config";

// Read-only adapter (implemented this phase).
export { listPools, PAIRS_QUERY, type PcsFetchFn } from "./client.js";
export { normalizePair, normalizePairs, parseDecimal, isValidRawPair } from "./pools.js";
export {
  PANCAKESWAP_BSC_CHAIN_ID,
  PANCAKESWAP_NODEREAL_BASE_URL,
  PANCAKESWAP_NODEREAL_FREE_PATH,
  PANCAKESWAP_NODEREAL_PREMIUM_PATH,
  PANCAKESWAP_NODEREAL_GRAPHQL_PATH,
  buildPancakeSwapEndpoint,
  PANCAKESWAP_SOURCE,
  type PancakeSwapTier,
  type PancakeSwapSource,
  type PancakeSwapPool,
  type PancakeSwapFailure,
  type PancakeSwapPoolResult,
  type ListPoolsOptions,
  type PcsRawToken,
  type PcsRawPair,
} from "./types.js";

/* --------------------------------------------------------------------------
 * DEFERRED (NOT IMPLEMENTED) — LP optimization / execution contract.
 * Retained as interface-only. Mutating methods are excluded from this phase;
 * the read surface above does not satisfy this execution-shaped interface.
 * ------------------------------------------------------------------------ */

export type PoolType = "stable" | "volatile";

export interface LpPool {
  id: string;
  dex: "pancakeswap";
  chain: ChainId;
  /** Pool symbol, e.g. "BNB/USDT". */
  symbol: string;
  poolType: PoolType;
  apr: number | null;
  apy: number | null;
  tvlUsd: number;
  volume24hUsd: number | null;
  updatedAt: string;
}

export interface PoolRankingQuery {
  chain?: ChainId;
  poolType?: PoolType;
  /** Sort field. */
  sortBy?: "apr" | "apy" | "tvl" | "volume24h";
  limit?: number;
}

/** Contract a future PancakeSwap execution/analytics adapter must satisfy. */
export interface PancakeSwapAdapter {
  readonly providerName: "pancakeSwap";
  // Execution/analytics methods (swap, add/remove liquidity, yield suggestions)
  // are NOT implemented in this read-only phase.
}

export const PCS_ADAPTER_NOT_IMPLEMENTED =
  "PancakeSwap execution/LP adapter is not implemented (read-only data only)." as const;
