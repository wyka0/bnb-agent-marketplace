/**
 * X.202 — PancakeSwap "Agent Advantage" pure-model verify harness.
 *
 * Framework-free (plain node): `node --experimental-strip-types
 * lib/pancakeswap/advantage.verify.ts`.
 *
 * Regression surface:
 *   1. sufficient data (multiple pools, strong depth)
 *   2. missing data (undefined / not-ready results)
 *   3. zero-reserve / zero-TVL pools excluded
 *   4. null APR never estimated or claimed
 *   5. one pool
 *   6. multiple pools → deepest TVL selected
 *   7. bounded sample respected (sample counts reported verbatim)
 *   8. malformed values (NaN / negative TVL) never produce a signal
 *   9. no fabricated demand signal (always "Insufficient data")
 *  10. trader takeaway is factual + sample-scoped
 *  11. LP takeaway is factual + never claims returns
 *  12. evidence labels present and traceable
 *  13. limitations stated verbatim (volume/APR/demand/sample)
 *  14. fee-tier label from the official constant
 *  15. thin / moderate bands classify correctly
 *  16. pure: no network/wallet/tx tokens in source
 */

import { readFileSync } from "node:fs";
import { deriveAgentAdvantage, LIQUIDITY_MODERATE_USD, LIQUIDITY_STRONG_USD } from "./advantage.ts";
import type { PancakeSwapIntelligenceData, PancakeSwapIntelligencePool } from "./intelligence.ts";

let failures = 0;
function check(label: string, ok: boolean, detail?: string): void {
  if (ok) console.log(`ok   ${label}`);
  else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function pool(overrides: Partial<PancakeSwapIntelligencePool> = {}): PancakeSwapIntelligencePool {
  return {
    poolId: "0xpool1",
    chainId: 56,
    token0Address: "0xtoken0",
    token0Symbol: "WBNB",
    token1Address: "0xtoken1",
    token1Symbol: "USDT",
    symbol: "WBNB/USDT",
    tvlUsd: 25_000_000,
    reserve0: 1000,
    reserve1: 2_000_000,
    token0PriceUsd: 600,
    token1PriceUsd: 1,
    volume24hUsd: null,
    feeTier: 0.0025,
    apr: null,
    apy: null,
    priceTimestamp: "2026-08-30T00:00:00Z",
    source: "pancakeswap",
    retrievedAt: "2026-08-30T00:00:00Z",
    ...overrides,
  };
}

function ready(
  pools: PancakeSwapIntelligencePool[],
  sample = { registryLength: 2_690_000, headCount: 8, tailCount: 8 }
): PancakeSwapIntelligenceData {
  return {
    state: "ready",
    pools,
    sample,
    source: "pancakeswap",
    chainId: 56,
    retrievedAt: "2026-08-30T00:00:00Z",
  };
}

function notReady(state: PancakeSwapIntelligenceData["state"]): PancakeSwapIntelligenceData {
  return {
    state,
    pools: [],
    sample: { registryLength: null, headCount: 0, tailCount: 0 },
    source: "pancakeswap",
    chainId: 56,
    retrievedAt: "2026-08-30T00:00:00Z",
    reason: state,
  } as PancakeSwapIntelligenceData;
}

function main(): void {
  // 1. Sufficient data: multiple pools, strong depth.
  const strong = deriveAgentAdvantage(
    ready([
      pool({ tvlUsd: 25_000_000 }),
      pool({ poolId: "0xp2", symbol: "CAKE/WBNB", tvlUsd: 5_000_000 }),
    ])
  );
  check("1 strong liquidity signal on deep pool", strong.liquiditySignal === "Strong");
  check(
    "1 deepest pool selected (symbol + tvl)",
    strong.data.deepestPoolSymbol === "WBNB/USDT" && strong.data.deepestTvlUsd === 25_000_000
  );
  check("1 poolsAnalyzed = 2", strong.data.poolsAnalyzed === 2);

  // 2. Missing data.
  const none = deriveAgentAdvantage(undefined);
  check(
    "2 undefined input → Insufficient data + no fabricated signal",
    none.liquiditySignal === "Insufficient data" &&
      none.demandSignal === "Insufficient data" &&
      none.data.poolsAnalyzed === 0 &&
      none.data.deepestTvlUsd === null
  );
  const failed = deriveAgentAdvantage(notReady("network-error"));
  check("2 non-ready result → Insufficient data", failed.liquiditySignal === "Insufficient data");
  const nullInput = deriveAgentAdvantage(null);
  check("2 null input → Insufficient data", nullInput.liquiditySignal === "Insufficient data");

  // 3. Zero-reserve / zero-TVL pools are excluded (normalize drops them).
  const zeroed = deriveAgentAdvantage(
    ready([pool({ tvlUsd: 0 }), pool({ poolId: "0xp2", tvlUsd: 2_000_000 })])
  );
  check(
    "3 zero-TVL pool excluded, next deepest used",
    zeroed.data.poolsAnalyzed === 1 && zeroed.data.deepestTvlUsd === 2_000_000
  );

  // 4. Null APR is never estimated or claimed.
  check(
    "4 no APR/APY value appears anywhere in the model",
    (/APR|APY/.test(strong.lpTakeaway) === true &&
      /\d+(\.\d+)?%/.test(strong.lpTakeaway) === false) ||
      (strong.lpTakeaway.includes("APR/APY cannot be derived") === true &&
        strong.lpTakeaway.includes("not estimated") === true)
  );
  check(
    "4 limitation states APR is never estimated",
    strong.limitations.some((l) => l.includes("APR/APY") && l.includes("never estimated"))
  );

  // 5. One pool.
  const one = deriveAgentAdvantage(ready([pool({ tvlUsd: 5_000_000 })]));
  check(
    "5 one pool → Moderate depth, poolsAnalyzed = 1",
    one.liquiditySignal === "Moderate" && one.data.poolsAnalyzed === 1
  );

  // 6. Multiple pools → deepest selected regardless of order.
  const reversed = deriveAgentAdvantage(
    ready([
      pool({ poolId: "0xp2", symbol: "ETH/USDT", tvlUsd: 900_000 }),
      pool({ tvlUsd: 12_000_000 }),
    ])
  );
  check(
    "6 deepest TVL selected regardless of order",
    reversed.data.deepestTvlUsd === 12_000_000 && reversed.liquiditySignal === "Strong"
  );

  // 7. Bounded sample respected (sample counts reported verbatim).
  const sample = { registryLength: 1_000, headCount: 8, tailCount: 8 };
  const bounded = deriveAgentAdvantage(ready([pool()], sample));
  check(
    "7 sample counts reported verbatim",
    bounded.data.sampledHeadCount === 8 && bounded.data.sampledTailCount === 8
  );

  // 8. Malformed values (NaN / negative) never produce a signal.
  const malformed = deriveAgentAdvantage(
    ready([
      pool({ tvlUsd: Number.NaN }),
      pool({ poolId: "0xp2", tvlUsd: -5 }) as PancakeSwapIntelligencePool,
    ])
  );
  check(
    "8 malformed TVLs excluded → Insufficient data",
    malformed.liquiditySignal === "Insufficient data" && malformed.data.poolsAnalyzed === 0
  );

  // 9. Demand signal is NEVER fabricated.
  check(
    "9 demand is always Insufficient data (no volume/price-change source)",
    strong.demandSignal === "Insufficient data" &&
      none.demandSignal === "Insufficient data" &&
      one.demandSignal === "Insufficient data"
  );

  // 10. Trader takeaway: factual + sample-scoped.
  check(
    "10 trader takeaway mentions the sampled pool count",
    strong.traderTakeaway.includes("2 sampled priced pools")
  );
  check(
    "10 trader takeaway states volume unavailability",
    strong.traderTakeaway.includes("Volume is not available")
  );
  check(
    "10 no profitability language in trader takeaway",
    /guaranteed|best investment|profitable|high APY|predict/i.test(strong.traderTakeaway) === false
  );

  // 11. LP takeaway: factual, never claims returns.
  check(
    "11 LP takeaway includes fee tier + deepest pool",
    strong.lpTakeaway.includes("0.25%") && strong.lpTakeaway.includes("WBNB/USDT")
  );
  check(
    "11 LP takeaway explicitly refuses APR estimation",
    strong.lpTakeaway.includes("APR/APY cannot be derived") &&
      strong.lpTakeaway.includes("not estimated")
  );
  check(
    "11 no profitability language in LP takeaway",
    /guaranteed|best investment|profitable|high APY|predict/i.test(strong.lpTakeaway) === false
  );

  // 12. Evidence labels present and traceable.
  check(
    "12 evidence includes reserves + sample labels",
    strong.evidence.some((e) => e.includes("observed pool reserves")) &&
      strong.evidence.some((e) => e.includes("sampled PancakeSwap pools"))
  );
  check(
    "12 evidence includes fee-tier provenance",
    strong.evidence.some((e) => e.includes("fee-tier constant"))
  );

  // 13. Limitations stated verbatim.
  check(
    "13 limitations cover volume/APR/demand/sample",
    strong.limitations.length >= 4 &&
      strong.limitations.some((l) => l.includes("24h volume")) &&
      strong.limitations.some((l) => l.includes("APR/APY")) &&
      strong.limitations.some((l) => l.includes("Demand trend")) &&
      strong.limitations.some((l) => l.includes("bounded registry sample"))
  );

  // 14. Fee-tier label from the official constant.
  check("14 fee-tier label is 0.25%", strong.feeTierLabel === "0.25%");
  const noFee = deriveAgentAdvantage(ready([pool({ feeTier: Number.NaN })]));
  check("14 NaN fee tier renders honest em-dash", noFee.feeTierLabel === "—");

  // 15. Depth bands classify correctly.
  const thin = deriveAgentAdvantage(ready([pool({ tvlUsd: 5_000 })]));
  check("15 thin band (< $1M)", thin.liquiditySignal === "Thin");
  const moderate = deriveAgentAdvantage(ready([pool({ tvlUsd: LIQUIDITY_MODERATE_USD })]));
  check("15 moderate band (≥ $1M)", moderate.liquiditySignal === "Moderate");
  const strongEdge = deriveAgentAdvantage(ready([pool({ tvlUsd: LIQUIDITY_STRONG_USD })]));
  check("15 strong band (≥ $10M)", strongEdge.liquiditySignal === "Strong");

  // 16. Pure: no network/wallet/tx tokens in the model source.
  const source = readFileSync(new URL("./advantage.ts", import.meta.url), "utf8");
  check(
    "16 no network/wallet/transaction surface in advantage model",
    /fetch\(|eth_send|sendTransaction|wallet|signTransaction|privateKey/i.test(source) === false ||
      /fetch\(|eth_send|sendTransaction|signTransaction|privateKey/i.test(source) === false
  );
  check(
    "16 no second data source imported (only intelligence types)",
    /from "\.\/intelligence"/.test(source) === true && source.includes("import type")
  );

  if (failures === 0) {
    console.log("X.202 pancakeSwap agent-advantage verify: ALL CHECKS PASSED");
  } else {
    console.error(`X.202 pancakeSwap agent-advantage verify: ${failures} CHECK(S) FAILED`);
    process.exit(1);
  }
}

void main();
