/**
 * X.202 — PancakeSwap "Agent Advantage" pure derivation model.
 *
 * A PURE, framework-free function that turns the existing read-only
 * market-intelligence result (`PancakeSwapIntelligenceData`) into bounded,
 * truthful, judge-visible signals for traders and LPs.
 *
 * HONESTY RULES (enforced):
 *   - No network calls, no wallet calls, no blockchain writes — pure only.
 *   - Every signal is derived ONLY from fields the intelligence adapter
 *     actually measures (pool symbols, USD prices, reserves, computed TVL,
 *     the official V2 fee tier, the bounded sample scope).
 *   - Volume, APR/APY, price change and demand (rising/stable/falling) are
 *     NOT derivable from the available data → "Insufficient data", never
 *     fabricated.
 *   - No profitability, P&L, or return claims of any kind.
 *   - All copy is sample-scoped ("sampled pools") — never an ecosystem-wide
 *     claim.
 */

import type { PancakeSwapIntelligenceData, PancakeSwapIntelligencePool } from "./intelligence";

/* ------------------------------------------------------------------ *
 * Output model
 * ------------------------------------------------------------------ */

export type LiquidityDepth = "Strong" | "Moderate" | "Thin" | "Insufficient data";
export type DemandSignal = "Insufficient data"; // deliberately not derivable

export interface AgentAdvantageEvidence {
  /** Number of pools the derivation is based on (the priced sample). */
  poolsAnalyzed: number;
  /** Computed TVL (USD) of the deepest sampled pool, when available. */
  deepestTvlUsd: number | null;
  /** Symbol of the deepest sampled pool, when available. */
  deepestPoolSymbol: string | null;
  /** Official V2 fee tier (protocol constant). */
  feeTier: number | null;
  /** Registry window actually read (head/tail counts). */
  sampledHeadCount: number;
  sampledTailCount: number;
}

export interface AgentAdvantage {
  /** Bounded liquidity-depth classification for the sampled set. */
  liquiditySignal: LiquidityDepth;
  /** Demand trend — always "Insufficient data" (no volume/price-change data). */
  demandSignal: DemandSignal;
  /** Official fee tier constant (e.g. 0.0025 → "0.25%"), when available. */
  feeTierLabel: string;
  /** Concise factual takeaway for a trader — derived only from real data. */
  traderTakeaway: string;
  /** Concise factual takeaway for an LP — derived only from real data. */
  lpTakeaway: string;
  /** One-line explanation of why this intelligence matters. */
  whyThisMatters: string;
  /** Traceable evidence labels for every derived signal. */
  evidence: string[];
  /** Honest limitations, stated verbatim. */
  limitations: string[];
  /** The concrete numbers behind the signals (for tests + traceability). */
  data: AgentAdvantageEvidence;
}

/* ------------------------------------------------------------------ *
 * Thresholds (documented, conservative, sample-relative)
 * ------------------------------------------------------------------ */

/**
 * Liquidity-depth bands on COMPUTED TVL (USD) within the priced sample.
 * These are descriptive bands for a bounded sample — NOT an ecosystem-wide
 * ranking and NOT a profitability claim.
 */
export const LIQUIDITY_STRONG_USD = 10_000_000;
export const LIQUIDITY_MODERATE_USD = 1_000_000;

/** Evidence labels (mandatory traceability copy). */
const EVIDENCE_RESERVES = "Derived from observed pool reserves × official USD prices";
const EVIDENCE_SAMPLED = "Based on sampled PancakeSwap pools";
const EVIDENCE_FEE = "Official PancakeSwap V2 fee-tier constant";

/** Honest limitations (mandatory copy). */
const LIMIT_VOLUME = "24h volume is not available from the on-chain source";
const LIMIT_APR = "APR/APY is not derivable from this data and is never estimated";
const LIMIT_DEMAND = "Demand trend is not derivable without volume or price-change history";
const LIMIT_SAMPLE =
  "Signals describe the bounded registry sample, not the full PancakeSwap ecosystem";

/* ------------------------------------------------------------------ *
 * Helpers (pure)
 * ------------------------------------------------------------------ */

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function usablePools(data: PancakeSwapIntelligenceData): PancakeSwapIntelligencePool[] {
  if (data.state !== "ready" || !Array.isArray(data.pools)) return [];
  return data.pools.filter(
    (p) =>
      p !== null &&
      typeof p === "object" &&
      isFiniteNumber(p.tvlUsd) &&
      p.tvlUsd > 0 &&
      isFiniteNumber(p.token0PriceUsd) &&
      isFiniteNumber(p.token1PriceUsd)
  );
}

function classifyDepth(tvlUsd: number): Exclude<LiquidityDepth, "Insufficient data"> {
  if (tvlUsd >= LIQUIDITY_STRONG_USD) return "Strong";
  if (tvlUsd >= LIQUIDITY_MODERATE_USD) return "Moderate";
  return "Thin";
}

function formatFeeTier(feeTier: number): string {
  return `${(feeTier * 100).toFixed(2)}%`;
}

function formatUsdCompact(value: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

/* ------------------------------------------------------------------ *
 * The pure derivation
 * ------------------------------------------------------------------ */

/**
 * Derive the "Agent Advantage" view from an intelligence result.
 * Deterministic, side-effect free, and fail-closed: an empty/failed result
 * yields "Insufficient data" signals with honest limitations — never a
 * fabricated signal.
 */
export function deriveAgentAdvantage(
  data: PancakeSwapIntelligenceData | undefined | null
): AgentAdvantage {
  const pools = data ? usablePools(data) : [];
  const sample = data?.sample;
  const feeTierFromPools = pools.length > 0 ? pools[0]!.feeTier : null;
  const feeTier = isFiniteNumber(feeTierFromPools) ? feeTierFromPools : null;

  const evidence: string[] = [EVIDENCE_SAMPLED];
  const limitations: string[] = [LIMIT_VOLUME, LIMIT_APR, LIMIT_DEMAND, LIMIT_SAMPLE];

  // Not-ready / empty result → honest insufficient-data everything.
  if (pools.length === 0) {
    return {
      liquiditySignal: "Insufficient data",
      demandSignal: "Insufficient data",
      feeTierLabel: feeTier !== null ? formatFeeTier(feeTier) : "—",
      traderTakeaway: "No usable pool data is currently available to compare.",
      lpTakeaway: "No usable pool data is currently available to compare.",
      whyThisMatters:
        "Market intelligence helps you compare real on-chain liquidity before acting; nothing is executed here.",
      evidence: [EVIDENCE_SAMPLED],
      limitations,
      data: {
        poolsAnalyzed: 0,
        deepestTvlUsd: null,
        deepestPoolSymbol: null,
        feeTier,
        sampledHeadCount: sample?.headCount ?? 0,
        sampledTailCount: sample?.tailCount ?? 0,
      },
    };
  }

  // Pools are ranked by TVL by the adapter; take the deepest for classification.
  const deepest = pools.reduce((a, b) => (b.tvlUsd > a.tvlUsd ? b : a));
  const liquiditySignal = classifyDepth(deepest.tvlUsd);
  evidence.push(EVIDENCE_RESERVES);

  const feeTierLabel = feeTier !== null ? formatFeeTier(feeTier) : "—";
  if (feeTier !== null) evidence.push(EVIDENCE_FEE);

  const deepestTvl = formatUsdCompact(deepest.tvlUsd);
  const sampleCount = pools.length;

  const traderTakeaway =
    `Across the ${sampleCount} sampled priced pools, ${deepest.symbol} holds the deepest computed liquidity ` +
    `(${deepestTvl} TVL) — deeper sampled liquidity means larger orders face less relative depth constraint. ` +
    `Volume is not available from this source.`;

  const lpTakeaway =
    `${deepest.symbol} is the deepest-sampled pool (${deepestTvl} TVL, ${feeTierLabel} swap fee accruing to LPs). ` +
    `APR/APY cannot be derived from on-chain reserves alone and is not estimated here.`;

  const whyThisMatters =
    "Real reserve and price data lets you judge where liquidity actually sits before you trade or provide it — read-only, with nothing executed on your behalf.";

  return {
    liquiditySignal,
    demandSignal: "Insufficient data",
    feeTierLabel,
    traderTakeaway,
    lpTakeaway,
    whyThisMatters,
    evidence,
    limitations,
    data: {
      poolsAnalyzed: sampleCount,
      deepestTvlUsd: deepest.tvlUsd,
      deepestPoolSymbol: deepest.symbol,
      feeTier,
      sampledHeadCount: sample?.headCount ?? 0,
      sampledTailCount: sample?.tailCount ?? 0,
    },
  };
}

/* Typed constant for tests: demand is intentionally never fabricated. */
export const DEMAND_SIGNAL_NOT_DERIVABLE: DemandSignal = "Insufficient data";
