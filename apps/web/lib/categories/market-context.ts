/**
 * X.54/X.69 category market context — real, attributed, non-fabricated.
 *
 * Turns the live PancakeSwap V2 pool read into the decision signals each Main
 * Track category actually needs, and states plainly which metrics the source
 * does NOT provide.
 *
 * X.69 adds: real token reserves (reserve0/reserve1) surfaced as liquidity
 * depth per category, swap-activity totals, and a per-category RECOMMENDATION
 * derived only from the real signals above. Every `recommendation` string is
 * literate guidance built from live values; it is never a metric and never an
 * execution promise.
 *
 * Honesty rules (enforced by lib/eight004scan/discovery/x54.depth.verify.ts):
 *  - Every number here is either read directly from the subgraph or derived by
 *    an arithmetic identity over subgraph values (ratio of two real figures).
 *  - APR/APY is NEVER estimated. The V2 subgraph exposes no fee/emission data,
 *    so yield stays `unavailable` with a stated reason.
 *  - `volumeUsd` is CUMULATIVE lifetime volume, not 24h. It is labelled as such
 *    everywhere it is surfaced, so turnover is never mistaken for daily volume.
 *  - Failure/absence is propagated as an honest state, never as zeros.
 */

import type { PancakeSwapPool, PancakeSwapPoolsData } from "../pancakeswap/client.ts";
import type { DiscoveryCategoryKey } from "../eight004scan/discovery/classifier.ts";

/** A single decision signal rendered in a category page. */
export type CategorySignal = {
  label: string;
  /** Real value, or `null` when the source cannot provide it. */
  value: string | null;
  /** Why the value is missing (only set when `value` is null). */
  unavailableReason?: string;
  help: string;
};

/** Metrics deliberately not shown, with the reason the source cannot supply them. */
export type UnavailableMetric = { label: string; reason: string };

export type CategoryMarketContext =
  | {
      state: "ready";
      /** Pools ordered as returned by the loader (already bounded). */
      pools: PoolContextRow[];
      signals: CategorySignal[];
      unavailable: UnavailableMetric[];
      /** Literate guidance derived ONLY from the real signals above. */
      recommendation: string;
      source: string;
      chainId: number;
      retrievedAt: string;
    }
  | {
      state: "unavailable";
      reason: string;
      message: string;
      signals: [];
      unavailable: UnavailableMetric[];
      /** Honest fallback: no real data ⇒ no derived recommendation. */
      recommendation: string;
      source: string;
      chainId: number;
      retrievedAt: string;
    };

/** Per-pool context with only verifiable fields plus explicit nulls. */
export type PoolContextRow = {
  poolId: string;
  symbol: string;
  tvlUsd: number;
  cumulativeVolumeUsd: number;
  totalTransactions: number;
  token0Symbol: string;
  token1Symbol: string;
  /** Real current token0 quantity held by the pool (subgraph reserve0). */
  reserve0: number;
  /** Real current token1 quantity held by the pool (subgraph reserve1). */
  reserve1: number;
  token0Price: number;
  token1Price: number;
  /** cumulativeVolumeUsd / tvlUsd — an identity over two real values. */
  turnoverRatio: number | null;
  /** Always null: the V2 subgraph publishes no APR/APY. */
  apr: null;
  apy: null;
};

export const PANCAKESWAP_YIELD_UNAVAILABLE_REASON =
  "The PancakeSwap V2 subgraph publishes no fee or emission data, so APR/APY cannot be computed without estimating. It is intentionally not shown.";

function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

function toRow(pool: PancakeSwapPool): PoolContextRow {
  return {
    poolId: pool.poolId,
    symbol: pool.symbol,
    tvlUsd: pool.tvlUsd,
    cumulativeVolumeUsd: pool.volumeUsd,
    totalTransactions: pool.totalTransactions,
    token0Symbol: pool.token0Symbol,
    token1Symbol: pool.token1Symbol,
    reserve0: pool.reserve0,
    reserve1: pool.reserve1,
    token0Price: pool.token0Price,
    token1Price: pool.token1Price,
    turnoverRatio: ratio(pool.volumeUsd, pool.tvlUsd),
    apr: null,
    apy: null,
  };
}

function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/** Real token quantity, compact — token amounts are NOT USD values. */
function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(2);
}

/** Real total swap count across the bounded sample (sum of real values). */
function poolSwapTotal(pools: PoolContextRow[]): number {
  return pools.reduce((sum, pool) => sum + pool.totalTransactions, 0);
}

/** Real token reserve pair of one pool, e.g. "12.35K WBNB + 8.10M USDT". */
function depthLabel(pool: PoolContextRow): string {
  return `${formatAmount(pool.reserve0)} ${pool.token0Symbol} + ${formatAmount(pool.reserve1)} ${pool.token1Symbol}`;
}

/** Metrics that are unavailable for every category, with reasons. */
function baseUnavailable(category: DiscoveryCategoryKey): UnavailableMetric[] {
  const shared: UnavailableMetric[] = [
    { label: "APR / APY", reason: PANCAKESWAP_YIELD_UNAVAILABLE_REASON },
    {
      label: "24h volume",
      reason: "The V2 pairs query returns cumulative lifetime volume only; a 24h window is not exposed, so it is not shown.",
    },
    {
      label: "Your positions / balances",
      reason: "No wallet is read on this page. Position-specific values require an activated agent scoped to your account.",
    },
    {
      label: "Realised performance / profit",
      reason: "No execution history exists in this marketplace, so performance figures would be fabricated.",
    },
  ];

  if (category === "health-factor-monitoring") {
    return [
      {
        label: "Health factor",
        reason: "A health factor is specific to one account on one lending market. No wallet position is read here, so no value is shown.",
      },
      {
        label: "Liquidation price / threshold distance",
        reason: "Requires live collateral and debt balances for a specific account, which this page does not read.",
      },
      ...shared.slice(2),
    ];
  }
  return shared;
}

/**
 * Build category-specific market context from the shared PancakeSwap read.
 * Pure: no network, no env, no clock beyond the loader's own timestamp.
 */
export function buildCategoryMarketContext(
  category: DiscoveryCategoryKey,
  data: PancakeSwapPoolsData
): CategoryMarketContext {
  const unavailable = baseUnavailable(category);

  if (data.state !== "ready") {
    return {
      state: "unavailable",
      reason: data.reason,
      message:
        "Live PancakeSwap pool data is unavailable right now, so market context is not shown. No substitute values are displayed.",
      signals: [],
      unavailable,
      recommendation:
        "Live market data is unavailable, so no data-derived recommendation can be given right now. Re-check later or verify the pair on the protocol directly before acting.",
      source: data.source,
      chainId: data.chainId,
      retrievedAt: data.retrievedAt,
    };
  }

  const pools = data.pools.map(toRow);

  // Health Factor draws no market context from a DEX pool read.
  if (category === "health-factor-monitoring") {
    return {
      state: "ready",
      pools: [],
      signals: [
        {
          label: "Live lending position",
          value: null,
          unavailableReason: "No wallet position is read on this page.",
          help: "Activate a monitoring agent so it can read your own lending position and compute a real health factor.",
        },
        {
          label: "Lending position source",
          value: null,
          unavailableReason:
            "No lending-market position source is configured here (no lending subgraph, RPC position reader, or verified health-factor tool).",
          help: "A health factor is computed from supplied collateral and outstanding debt on one specific lending market.",
        },
        {
          label: "Collateral / debt snapshot",
          value: null,
          unavailableReason: "Requires a wallet address and a supported lending market; neither is read on this page.",
          help: "Without real collateral and debt values no liquidation distance can be calculated.",
        },
      ],
      unavailable,
      recommendation:
        "No lending position is read on this page, so no health factor exists here and none is invented. Pick a monitoring agent from the matched records above, activate it with read access on the lending market that holds your position, and only act on the real value it reports.",
      source: data.source,
      chainId: data.chainId,
      retrievedAt: data.retrievedAt,
    };
  }

  if (pools.length === 0) {
    return {
      state: "unavailable",
      reason: "empty",
      message: "The pool query succeeded but returned no pools, so no market context is shown.",
      signals: [],
      unavailable,
      recommendation:
        "The pool query returned no pools, so no data-derived recommendation can be given. No substitute values are used.",
      source: data.source,
      chainId: data.chainId,
      retrievedAt: data.retrievedAt,
    };
  }

  const totalTvl = pools.reduce((sum, pool) => sum + pool.tvlUsd, 0);
  const deepest = pools.reduce((best, pool) => (pool.tvlUsd > best.tvlUsd ? pool : best), pools[0] as PoolContextRow);
  const busiest = pools.reduce(
    (best, pool) => (pool.totalTransactions > best.totalTransactions ? pool : best),
    pools[0] as PoolContextRow
  );
  const highestTurnover = pools
    .filter((pool): pool is PoolContextRow & { turnoverRatio: number } => pool.turnoverRatio !== null)
    .reduce<(PoolContextRow & { turnoverRatio: number }) | null>(
      (best, pool) => (best === null || pool.turnoverRatio > best.turnoverRatio ? pool : best),
      null
    );

  const shared: CategorySignal[] = [
    {
      label: "Pools observed",
      value: String(pools.length),
      help: "Bounded sample of PancakeSwap V2 pools ranked by the loader, not the whole DEX.",
    },
    {
      label: "Combined liquidity (TVL)",
      value: formatUsd(totalTvl),
      help: "Sum of reserveUSD across the observed pools, read directly from the subgraph.",
    },
    {
      label: "Deepest pool",
      value: `${deepest.symbol} · ${formatUsd(deepest.tvlUsd)}`,
      help: "Highest liquidity in the sample. Deeper liquidity generally means lower slippage.",
    },
  ];

  if (category === "yield-optimisation") {
    const turnoverPool = highestTurnover;
    return {
      state: "ready",
      pools,
      signals: [
        ...shared,
        {
          label: "Highest turnover pool",
          value: turnoverPool ? `${turnoverPool.symbol} · ${turnoverPool.turnoverRatio.toFixed(2)}x` : null,
          unavailableReason: turnoverPool ? undefined : "No pool in the sample had a positive TVL to compare against.",
          help: "Cumulative volume divided by current TVL. Higher turnover means the pool has traded more per dollar of liquidity — a fee-activity proxy, NOT a yield figure.",
        },
        {
          label: "Liquidity (highest turnover pool)",
          value: turnoverPool ? depthLabel(turnoverPool) : null,
          unavailableReason: turnoverPool ? undefined : "No eligible pool found in the sample.",
          help: "Real current token reserves of the pool with the highest turnover — the actual depth capital would trade against.",
        },
        {
          label: "Swaps (highest turnover pool)",
          value: turnoverPool ? turnoverPool.totalTransactions.toLocaleString("en-US") : null,
          unavailableReason: turnoverPool ? undefined : "No eligible pool found in the sample.",
          help: "Cumulative swap count of that pool, read directly from the subgraph.",
        },
        {
          label: "Yield (APR / APY)",
          value: null,
          unavailableReason: PANCAKESWAP_YIELD_UNAVAILABLE_REASON,
          help: "Compare liquidity and turnover instead, then verify yield at the protocol before committing capital.",
        },
      ],
      unavailable,
      recommendation: turnoverPool
        ? `The most active liquidity in this sample sits in ${turnoverPool.symbol} (${formatUsd(turnoverPool.tvlUsd)} TVL, ${depthLabel(turnoverPool)}, ${turnoverPool.turnoverRatio.toFixed(2)}x lifetime turnover). Use liquidity and turnover to compare pools — APR/APY is not verifiable from this source, so treat advertised yields as unverified until confirmed on the protocol.`
        : "The observed pools cannot be ranked by turnover, so no pool comparison can be derived. Compare liquidity directly at the protocol before committing capital.",
      source: data.source,
      chainId: data.chainId,
      retrievedAt: data.retrievedAt,
    };
  }

  if (category === "rebalancing") {
    return {
      state: "ready",
      pools,
      signals: [
        ...shared,
        {
          label: "Reference price (deepest pool)",
          value: `1 ${deepest.token0Symbol} = ${deepest.token0Price.toFixed(6)} ${deepest.token1Symbol}`,
          help: "Live token0Price from the deepest observed pool — the pair a rebalance would most likely route through.",
        },
        {
          label: "Liquidity depth (deepest pool)",
          value: depthLabel(deepest),
          help: "Real current token reserves of the deepest pool — the actual quantity tradeable against before depth thins out.",
        },
        {
          label: "Swap activity (sample)",
          value: poolSwapTotal(pools).toLocaleString("en-US"),
          help: "Sum of cumulative swap counts across the observed pools, read directly from the subgraph.",
        },
        {
          label: "Rebalance cost context",
          value: null,
          unavailableReason: "Gas and routing costs depend on the executing account and route, which this page does not read.",
          help: "A rebalance is only worthwhile when expected drift correction exceeds execution cost.",
        },
      ],
      unavailable,
      recommendation: `The deepest observed routing pair is ${deepest.symbol} (${formatUsd(deepest.tvlUsd)} TVL, ${depthLabel(deepest)}; reference price 1 ${deepest.token0Symbol} = ${deepest.token0Price.toFixed(6)} ${deepest.token1Symbol}). Use it as the routing reference when comparing drift — and only rebalance when measured drift exceeds the expected gas plus slippage cost, since this page shows market context, not your positions.`,
      source: data.source,
      chainId: data.chainId,
      retrievedAt: data.retrievedAt,
    };
  }

  // grid-trading
  return {
    state: "ready",
    pools,
    signals: [
      ...shared,
      {
        label: "Most active pool",
        value: `${busiest.symbol} · ${busiest.totalTransactions.toLocaleString("en-US")} swaps`,
        help: "Cumulative swap count. Grid strategies depend on frequent two-way trading activity.",
      },
      {
        label: "Liquidity depth (most active pool)",
        value: depthLabel(busiest),
        help: "Real current token reserves of the most active pool — what a grid would actually trade against.",
      },
      {
        label: "Current price (most active pool)",
        value: `1 ${busiest.token0Symbol} = ${busiest.token0Price.toFixed(6)} ${busiest.token1Symbol}`,
        help: "Live token0Price of the most active observed pool, read directly from the subgraph.",
      },
      {
        label: "Grid range / volatility window",
        value: null,
        unavailableReason: "Historical price series is not available from the pairs query, so a range cannot be derived without estimating.",
        help: "Set a grid range from a verified price history source; this page will not infer one.",
      },
    ],
    unavailable,
    recommendation: `The most active observed pool is ${busiest.symbol} (${busiest.totalTransactions.toLocaleString("en-US")} cumulative swaps, ${formatUsd(busiest.tvlUsd)} TVL, ${depthLabel(busiest)}; current reference price 1 ${busiest.token0Symbol} = ${busiest.token0Price.toFixed(6)} ${busiest.token1Symbol}). Two-way activity exists to fill levels, but a grid range cannot be derived from this source — obtain a verified price history before setting levels, and never treat a range here as an estimate.`,
    source: data.source,
    chainId: data.chainId,
    retrievedAt: data.retrievedAt,
  };
}
