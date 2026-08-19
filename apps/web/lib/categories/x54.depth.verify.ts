/**
 * X.54 Main Track depth verifier.
 *
 * Proves the four categories are comparably deep, that live market context is
 * derived only from real subgraph values, and that no metric is fabricated when
 * the upstream source cannot supply it.
 *
 * Pure/offline: the market-context builder is exercised with TEST FIXTURE pool
 * payloads. No network, no env, no database, no chain access.
 */

import { readFileSync } from "node:fs";
import {
  buildCategoryMarketContext,
  PANCAKESWAP_YIELD_UNAVAILABLE_REASON,
} from "./market-context.ts";
import type { PancakeSwapPool, PancakeSwapPoolsData } from "../pancakeswap/client.ts";
import type { DiscoveryCategoryKey } from "../eight004scan/discovery/classifier.ts";

let checks = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = ""): void {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"} ${checks}. ${label}${detail ? ` — ${detail}` : ""}`);
}

function read(path: string): string {
  return readFileSync(path, "utf8");
}

const CATEGORY_PAGES: ReadonlyArray<{ key: DiscoveryCategoryKey; path: string; title: string }> = [
  { key: "rebalancing", path: "app/(app)/categories/rebalancing/page.tsx", title: "Rebalancing" },
  { key: "grid-trading", path: "app/(app)/categories/grid-trading/page.tsx", title: "Grid Trading" },
  { key: "yield-optimisation", path: "app/(app)/categories/yield/page.tsx", title: "Yield Optimization" },
  { key: "health-factor-monitoring", path: "app/(app)/categories/health-factor/page.tsx", title: "Health Factor" },
];

function pool(overrides: Partial<PancakeSwapPool> & { poolId: string; symbol: string }): PancakeSwapPool {
  return {
    poolId: overrides.poolId,
    chainId: 56,
    token0Address: overrides.token0Address ?? "0xtoken0",
    token0Symbol: overrides.token0Symbol ?? "WBNB",
    token1Address: overrides.token1Address ?? "0xtoken1",
    token1Symbol: overrides.token1Symbol ?? "CAKE",
    symbol: overrides.symbol,
    tvlUsd: overrides.tvlUsd ?? 1_000_000,
    volumeUsd: overrides.volumeUsd ?? 5_000_000,
    token0Price: overrides.token0Price ?? 2.5,
    token1Price: overrides.token1Price ?? 0.4,
    totalTransactions: overrides.totalTransactions ?? 1_000,
    reserve0: overrides.reserve0 ?? 1_000,
    reserve1: overrides.reserve1 ?? 400,
    apr: null,
    apy: null,
    source: "pancakeswap-v2-subgraph" as PancakeSwapPool["source"],
    retrievedAt: overrides.retrievedAt ?? "2026-08-15T10:00:00.000Z",
  };
}

function readyData(pools: PancakeSwapPool[]): PancakeSwapPoolsData {
  return {
    state: "ready",
    pools,
    source: "pancakeswap-v2-subgraph" as PancakeSwapPoolsData["source"],
    chainId: 56,
    retrievedAt: "2026-08-15T10:00:00.000Z",
  };
}

function failedData(reason: "rate-limited" | "network-error" | "unauthorized"): PancakeSwapPoolsData {
  return {
    state: reason,
    pools: [],
    source: "pancakeswap-v2-subgraph" as PancakeSwapPoolsData["source"],
    chainId: 56,
    retrievedAt: "2026-08-15T10:00:00.000Z",
    reason,
  };
}

async function main(): Promise<void> {
  const dashboard = read("components/category-dashboard.tsx");
  const sources = CATEGORY_PAGES.map(({ path }) => read(path));

  // 1-4. Comparable depth: every category supplies every required content block.
  {
    const required = ["monitors:", "capability:", "whyUseful:", "decisionSignals", "risks:", "executionMode:", "activationNote:"];
    check("every category supplies all required depth fields", sources.every((src) => required.every((field) => src.includes(field))), required.join(" "));
    const riskCounts = sources.map((src) => (src.split("risks:")[1] ?? "").split("]")[0]?.split(/^\s{10}"/m).length ?? 0);
    check("every category states multiple risks/limitations", riskCounts.every((count) => count >= 4), `risk blocks=${riskCounts.join(",")}`);
    const signalCounts = sources.map((src) => ((src.split("decisionSignals")[1] ?? "").split("]")[0]?.match(/^\s{10}"/gm) ?? []).length);
    check("every category states multiple decision signals", signalCounts.every((count) => count >= 5), `signals=${signalCounts.join(",")}`);
    check("no category page reintroduces a placeholder metric or 'coming soon'", sources.every((src) => !/value:\s*"—"/.test(src) && !/coming soon/i.test(src)));
  }

  // 5-6. Execution vs analysis is labelled unambiguously everywhere.
  {
    check("every category declares analysis-only execution mode", sources.every((src) => src.includes('executionMode: "analysis-only"')));
    check("dashboard renders an explicit analysis-only capability badge", /Analysis \/ recommendation only/.test(dashboard));
  }

  // 7-10. Market context uses only real values, per category.
  {
    const pools = [
      pool({ poolId: "0x1", symbol: "WBNB/CAKE", tvlUsd: 2_000_000, volumeUsd: 8_000_000, totalTransactions: 5_000 }),
      pool({ poolId: "0x2", symbol: "USDT/WBNB", tvlUsd: 500_000, volumeUsd: 4_000_000, totalTransactions: 9_000 }),
    ];
    const yieldCtx = buildCategoryMarketContext("yield-optimisation", readyData(pools));
    check("yield context reports real liquidity and turnover from subgraph values", yieldCtx.state === "ready" && yieldCtx.signals.some((s) => s.label === "Combined liquidity (TVL)" && s.value !== null) && yieldCtx.signals.some((s) => s.label === "Highest turnover pool" && s.value !== null));
    const yieldSignal = yieldCtx.state === "ready" ? yieldCtx.signals.find((s) => s.label === "Yield (APR / APY)") : undefined;
    check("yield APR/APY stays unavailable with a stated reason (never estimated)", yieldSignal?.value === null && yieldSignal?.unavailableReason === PANCAKESWAP_YIELD_UNAVAILABLE_REASON);
    const turnover = yieldCtx.state === "ready" ? yieldCtx.pools[0]?.turnoverRatio : undefined;
    check("turnover is an exact identity over two real values", turnover === 8_000_000 / 2_000_000, `computed=${turnover}`);
    check("every pool row keeps apr/apy null", yieldCtx.state === "ready" && yieldCtx.pools.every((row) => row.apr === null && row.apy === null));
  }

  // 11-13. Category-appropriate signals.
  {
    const pools = [pool({ poolId: "0x1", symbol: "WBNB/CAKE", tvlUsd: 2_000_000, totalTransactions: 7_777 })];
    const rebalance = buildCategoryMarketContext("rebalancing", readyData(pools));
    check("rebalancing context surfaces a live reference price", rebalance.state === "ready" && rebalance.signals.some((s) => s.label === "Reference price (deepest pool)" && (s.value ?? "").includes("WBNB")));
    const grid = buildCategoryMarketContext("grid-trading", readyData(pools));
    check("grid context surfaces real swap activity and refuses to infer a range", grid.state === "ready" && grid.signals.some((s) => s.label === "Most active pool" && (s.value ?? "").includes("7,777")) && grid.signals.some((s) => s.label === "Grid range / volatility window" && s.value === null));
    const health = buildCategoryMarketContext("health-factor-monitoring", readyData(pools));
    check("health-factor context shows no synthetic position and no DEX pools", health.state === "ready" && health.pools.length === 0 && health.signals.every((s) => s.value === null) && health.unavailable.some((m) => m.label === "Health factor"));
  }

  // 14-16. Upstream failure, empty, and malformed handling.
  {
    const rateLimited = buildCategoryMarketContext("yield-optimisation", failedData("rate-limited"));
    check("upstream failure yields an honest unavailable state with no values", rateLimited.state === "unavailable" && rateLimited.signals.length === 0 && rateLimited.reason === "rate-limited");
    const empty = buildCategoryMarketContext("rebalancing", readyData([]));
    check("empty pool result is reported as unavailable, not zeros", empty.state === "unavailable" && empty.reason === "empty");
    const zeroTvl = buildCategoryMarketContext("yield-optimisation", readyData([pool({ poolId: "0x0", symbol: "DEAD/POOL", tvlUsd: 0, volumeUsd: 1_000 })]));
    check("zero/degenerate TVL never produces Infinity or NaN turnover", zeroTvl.state === "ready" && zeroTvl.pools[0]?.turnoverRatio === null);
  }

  // 17-18. Unavailable metrics are always declared.
  {
    for (const key of ["rebalancing", "grid-trading", "yield-optimisation", "health-factor-monitoring"] as DiscoveryCategoryKey[]) {
      const ctx = buildCategoryMarketContext(key, readyData([pool({ poolId: "0x1", symbol: "A/B" })]));
      if (ctx.unavailable.length === 0) {
        check(`unavailable metrics declared for ${key}`, false);
        return;
      }
    }
    check("every category declares which metrics are intentionally unavailable", true);
    const ctx = buildCategoryMarketContext("rebalancing", readyData([pool({ poolId: "0x1", symbol: "A/B" })]));
    check("fabrication-prone metrics are explicitly excluded", ctx.unavailable.some((m) => /positions|balances/i.test(m.label)) && ctx.unavailable.some((m) => /performance|profit/i.test(m.label)));
  }

  // 19-21. Rendering honesty + provenance in the dashboard.
  {
    check("dashboard labels cumulative volume as not 24h", /cumulative lifetime volume, not 24h/i.test(dashboard));
    check("dashboard renders APR/APY as Unavailable rather than a number", /APR \/ APY<\/th>/.test(dashboard) && /Unavailable/.test(dashboard));
    check("dashboard attributes market data with source, chain and timestamp", dashboard.includes("Live PancakeSwap V2 pool data") && dashboard.includes("market.chainId") && dashboard.includes("market.retrievedAt"));
  }

  // 22-23. Security + activation path preserved.
  {
    check("PancakeSwap loader keeps its server-only boundary", read("lib/pancakeswap/client.ts").includes('import "server-only"'));
    check("activation path into the agent page is preserved", dashboard.includes("/agents/") && /review capability, permissions and activation/i.test(dashboard));
  }

  // 24-31 (X.69). Depth completion: real reserves, per-category recommendations, explicit verification gaps.
  {
    const pools = [
      pool({ poolId: "0x1", symbol: "WBNB/CAKE", tvlUsd: 2_000_000, volumeUsd: 8_000_000, totalTransactions: 5_000, reserve0: 12_350, reserve1: 8_100_000 }),
      pool({ poolId: "0x2", symbol: "USDT/WBNB", tvlUsd: 500_000, volumeUsd: 4_000_000, totalTransactions: 9_000, reserve0: 90_000, reserve1: 2_250 }),
    ];
    const client = read("lib/pancakeswap/client.ts");
    check("PancakeSwap client validates real reserve fields on raw pairs", /parseDecimal\(p\.reserve0\)/.test(client) && /parseDecimal\(p\.reserve1\)/.test(client));
    check("PancakeSwap normalization maps reserves to real numbers", /reserve0:\s*parseDecimal\(raw\.reserve0\)/.test(client) && /reserve1:\s*parseDecimal\(raw\.reserve1\)/.test(client));

    const rebCtx = buildCategoryMarketContext("rebalancing", readyData(pools));
    check("rebalancing pools expose token1 price and real reserves", rebCtx.state === "ready" && rebCtx.pools.every((row) => row.reserve0 > 0 && row.reserve1 > 0 && row.token1Price > 0));
    check("rebalancing recommendation is derived and names its values", rebCtx.state === "ready" && /deepest observed routing pair/i.test(rebCtx.recommendation) && rebCtx.recommendation.includes("WBNB/CAKE") && rebCtx.recommendation.includes("$2.00M"));

    const gridCtx = buildCategoryMarketContext("grid-trading", readyData(pools));
    check("grid recommendation derives from real swap totals and refuses range inference", gridCtx.state === "ready" && gridCtx.recommendation.includes("9,000") && /range cannot be derived/.test(gridCtx.recommendation));

    const yieldCtx = buildCategoryMarketContext("yield-optimisation", readyData(pools));
    check("yield recommendation compares real pools and flags APR/APY as unverifiable", yieldCtx.state === "ready" && yieldCtx.recommendation.includes("8.00x") && /APR\/APY is not verifiable/.test(yieldCtx.recommendation));

    const healthCtx = buildCategoryMarketContext("health-factor-monitoring", readyData(pools));
    check("health-factor recommendation invents no position or value", healthCtx.state === "ready" && /no health factor exists here and none is invented/i.test(healthCtx.recommendation) && healthCtx.pools.length === 0);

    const empty = buildCategoryMarketContext("grid-trading", readyData([]));
    const failed = buildCategoryMarketContext("yield-optimisation", failedData("network-error"));
    check("unavailable and empty states still carry an honest recommendation", empty.state === "unavailable" && /no data-derived recommendation/.test(empty.recommendation) && failed.state === "unavailable" && failed.recommendation.length > 0);
  }

  // 32-35 (X.69). Rendering of recommendation, breakdown and verification gaps.
  {
    check("dashboard renders the data-derived recommendation", /What these agents recommend/.test(dashboard) && dashboard.includes("market.recommendation"));
    check("dashboard breaks down Analysis / Recommendation / Execution", /Capability breakdown/.test(dashboard) && /Analysis/.test(dashboard) && /Recommendation/.test(dashboard) && /Execution/.test(dashboard));
    check("dashboard renders explicit verification gaps", /What cannot be verified yet/.test(dashboard));
    check("every category supplies a verificationGap list", sources.every((src) => src.includes("verificationGap:")));
  }

  // 36-38 (X.69). No fabricated metric language anywhere in the category surface.
  {
    const gridSrc = sources[1];
    const yieldSrc = sources[2];
    const healthSrc = sources[3];
    check("grid page never claims backtest, win rate or placed orders", !/backtest (shows|results|indicates)|win rate (of|\d)|order[s]? (placed|executed)/i.test(gridSrc));
    check("yield page never presents a numeric APY", !/\$?\d[\d,]*(\.\d+)?\s*%(APY| APR)?\b/i.test(yieldSrc.replace(/APR\/APY is NOT published/g, "")));
    check("health page never displays or estimates a health factor value", !/health factor[\s\S]{0,120}?\d(\.\d+)?\b/i.test(healthSrc.replace(/never displays a synthetic health factor/g, "")));
  }

  console.log(`X.54 DEPTH VERIFIER: ${checks} checks, ${failures} failures — ${failures === 0 ? "ALL PASS" : "FAILURES PRESENT"}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`X.54 BLOCKED — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
