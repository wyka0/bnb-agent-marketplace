/**
 * PancakeSwap — normalization of raw V2-subgraph `Pair` records into the
 * application shape. Honest rules:
 *   - numeric parse failures / missing tokens make a record INVALID and it is
 *     dropped (never coerced to 0);
 *   - `apr`/`apy` are always `null` — the V2 subgraph does not provide them;
 *   - `volumeUsd` is documented as CUMULATIVE (not 24h) — never relabeled.
 */

import {
  PANCAKESWAP_BSC_CHAIN_ID,
  PANCAKESWAP_SOURCE,
  type PancakeSwapPool,
  type PcsRawPair,
  type PcsRawToken,
} from "./types.js";

/** Parse a decimal string to a number; returns null when absent/NaN/not finite. */
export function parseDecimal(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Whether a raw pair row has every field needed for a faithful record. */
export function isValidRawPair(value: unknown): value is PcsRawPair {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    isValidToken(p.token0) &&
    isValidToken(p.token1) &&
    parseDecimal(p.reserveUSD) !== null &&
    parseDecimal(p.volumeUSD) !== null &&
    parseDecimal(p.token0Price) !== null &&
    parseDecimal(p.token1Price) !== null &&
    parseDecimal(p.totalTransactions) !== null
  );
}

function isValidToken(value: unknown): value is PcsRawToken {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === "string" && typeof t.symbol === "string";
}

/** Normalize one validated raw pair. Invalid rows return null (dropped). */
export function normalizePair(raw: unknown): PancakeSwapPool | null {
  if (!isValidRawPair(raw)) return null;
  const tvl = parseDecimal(raw.reserveUSD)!;
  const volume = parseDecimal(raw.volumeUSD)!;
  const token0Price = parseDecimal(raw.token0Price)!;
  const token1Price = parseDecimal(raw.token1Price)!;
  const totalTransactions = parseDecimal(raw.totalTransactions)!;

  return {
    poolId: raw.id,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    token0Address: raw.token0.id,
    token0Symbol: raw.token0.symbol,
    token1Address: raw.token1.id,
    token1Symbol: raw.token1.symbol,
    symbol: `${raw.token0.symbol}/${raw.token1.symbol}`,
    tvlUsd: tvl,
    volumeUsd: volume,
    token0Price,
    token1Price,
    totalTransactions,
    apr: null, // V2 subgraph does not provide APR — never fabricate
    apy: null, // V2 subgraph does not provide APY — never fabricate
    source: PANCAKESWAP_SOURCE,
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Normalize a batch of raw pairs. Invalid rows are dropped; a batch where EVERY
 * row is invalid yields an empty array (the caller surfaces it as not-found —
 * never as fabricated zeros).
 */
export function normalizePairs(rawList: unknown[]): PancakeSwapPool[] {
  const out: PancakeSwapPool[] = [];
  for (const raw of rawList) {
    const n = normalizePair(raw);
    if (n !== null) out.push(n);
  }
  return out;
}
