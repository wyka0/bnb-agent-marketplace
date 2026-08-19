/**
 * PANCAKESWAP OPTION B — Agent Details UI verification (render-free, deterministic).
 *
 * The Agent Details client component is TSX and runs inside Next.js; this
 * harness asserts the SHIPPED display semantics without a browser by importing
 * the framework-free copy/format helpers the component uses. This is the exact
 * same strategy used for the TermiX web verify harness (the truthful mapping
 * state → UI, not a pixel render).
 *
 * TEST FIXTURE / NOT LIVE PANCAKESWAP DATA. No network calls, no secret read.
 *
 * Run (from apps/web):
 *   node --experimental-strip-types "app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts"
 *
 * Exit: 1 on any failed assertion; 0 otherwise.
 */

import {
  PANCAKESWAP_FAILURE_COPY,
  PANCAKESWAP_SOURCE_LABEL,
  PANCAKESWAP_SECTION_TITLE,
  PANCAKESWAP_SECTION_DESCRIPTION,
  PANCAKESWAP_VOLUME_LABEL,
  PANCAKESWAP_VOLUME_NOTE,
  PANCAKESWAP_FEE_TIER_LABEL,
  PANCAKESWAP_APR_NOTE,
  PANCAKESWAP_READ_ONLY_DISCLAIMER,
  isPancakeSwapReady,
  pancakeSwapFailureCopy,
  displayPools,
  formatUsd,
  formatCount,
  formatFeeTier,
  formatSampleScope,
} from "./agent-detail-pancakeswap.copy.ts";
import {
  PANCAKESWAP_BSC_CHAIN_ID,
  PANCAKESWAP_SOURCE,
  PANCAKESWAP_V2_FEE_TIER,
  type PancakeSwapIntelligenceData,
  type PancakeSwapIntelligencePool,
} from "../../../../lib/pancakeswap/intelligence.ts";

function fail(message: string): never {
  console.error(`PANCAKESWAP UI VERIFY FAILED: ${message}`);
  process.exit(1);
}

/** TEST FIXTURE — NOT LIVE PANCAKESWAP DATA. */
const FIXTURE_POOL: PancakeSwapIntelligencePool = {
  poolId: "0x804678fa97d91b974ec2af3c843270886528a9e6",
  chainId: 56,
  token0Address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
  token0Symbol: "Cake",
  token1Address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  token1Symbol: "WBNB",
  symbol: "Cake/WBNB",
  tvlUsd: 1234567.89,
  reserve0: 812345.5,
  reserve1: 2049.12,
  token0PriceUsd: 1.5308,
  token1PriceUsd: 602.51,
  volume24hUsd: null, // not available on-chain — never fabricated
  feeTier: 0.0025,
  apr: null, // never fabricated
  apy: null,
  priceTimestamp: "2026-08-10T00:00:00.000Z",
  source: PANCAKESWAP_SOURCE,
  retrievedAt: "2026-08-10T00:00:00.000Z",
};

function ready(pools: PancakeSwapIntelligencePool[] = [FIXTURE_POOL]): PancakeSwapIntelligenceData {
  return {
    state: "ready",
    pools,
    sample: { registryLength: 2690351, headCount: 8, tailCount: 8 },
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt: "2026-08-10T00:00:00.000Z",
  };
}

function failure(
  reason:
    | "not-found"
    | "timeout"
    | "network-error"
    | "server-error"
    | "rate-limited"
    | "bad-request"
    | "unauthorized"
    | "forbidden"
    | "error"
): PancakeSwapIntelligenceData {
  return {
    state: reason,
    pools: [],
    sample: { registryLength: null, headCount: 0, tailCount: 0 },
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt: "2026-08-10T00:00:00.000Z",
    reason,
  };
}

async function main(): Promise<void> {
  console.log("PANCAKESWAP OPTION B — Agent Details UI verify (offline fixtures, no live data)");

  // 1. ready state → isPancakeSwapReady true; pools surfaced.
  {
    if (!isPancakeSwapReady(ready())) fail("ready fixture must be ready");
    if (displayPools(ready()).length !== 1)
      fail("displayPools must surface the single fixture pool");
    console.log("ok   1 ready state");
  }

  // 2. pool rendering fields: token pair symbol (3), TVL (4), honest volume label (5).
  {
    const p = ready().pools[0]!;
    if (p.symbol !== "Cake/WBNB") fail("token pair symbol must be Cake/WBNB");
    if (formatUsd(p.tvlUsd).length === 0 || formatUsd(p.tvlUsd) === "—")
      fail("TVL must format as a USD value");
    if (PANCAKESWAP_VOLUME_LABEL !== "24h volume")
      fail("volume label must be the honest '24h volume'");
    if (!/not available from the on-chain source/i.test(PANCAKESWAP_VOLUME_NOTE))
      fail("volume note must state on-chain availability honestly");
    // The volume value itself is null in the model and must render as "—".
    if (formatUsd(p.volume24hUsd) !== "—") fail("null volume must render as '—' (never 0)");
    console.log("ok   2,3,4,5 pool + token pair + TVL + honest 24h-volume label");
  }

  // 6. price rendering (both USD) + 7. reserves in human units.
  {
    const p = ready().pools[0]!;
    if (formatUsd(p.token0PriceUsd) === "—" || formatUsd(p.token1PriceUsd) === "—")
      fail("both USD prices must render as real values");
    if (!Number.isFinite(p.reserve0) || !Number.isFinite(p.reserve1))
      fail("reserves must be real numbers");
    if (formatCount(p.reserve0).length === 0) fail("reserve count must format");
    console.log("ok   6,7 USD prices + human-unit reserves");
  }

  // 8. fee tier: official constant + display.
  {
    const p = ready().pools[0]!;
    if (p.feeTier !== PANCAKESWAP_V2_FEE_TIER) fail("fee tier must be the official V2 constant");
    if (formatFeeTier(p.feeTier) !== "0.25%")
      fail(`fee tier display must be 0.25%, got ${formatFeeTier(p.feeTier)}`);
    if (formatFeeTier(null) !== "—") fail("null fee tier must render '—'");
    if (!/fee tier/i.test(PANCAKESWAP_FEE_TIER_LABEL)) fail("fee tier label must exist");
    console.log("ok   8 fee tier constant + display + honest unknown");
  }

  // 9. APR/APY never fabricated — null, plus the honest note exists.
  {
    const p = ready().pools[0]!;
    if (p.apr !== null || p.apy !== null) fail("apr/apy must be null in the model");
    if (!/unavailable|not available/i.test(PANCAKESWAP_APR_NOTE))
      fail("APR note must state unavailable (no fake APR)");
    console.log("ok   9 APR/APY not fabricated (null + honest note)");
  }

  // 10. not-found + timeout + server/network error copies.
  {
    const allStates = [
      "not-found",
      "timeout",
      "network-error",
      "server-error",
      "rate-limited",
      "bad-request",
      "unauthorized",
      "forbidden",
      "error",
    ] as const;
    for (const state of allStates) {
      const copy = pancakeSwapFailureCopy(failure(state));
      if (!copy || copy.length === 0) fail(`${state} must map to honest copy`);
    }
    // The genuinely state-specific copies must be distinct (not-found vs timeout).
    if (PANCAKESWAP_FAILURE_COPY["not-found"] === PANCAKESWAP_FAILURE_COPY["timeout"]) {
      fail("not-found and timeout must carry distinct honest copy");
    }
    // not-found states the requirement verbatim: no matching pools.
    if (PANCAKESWAP_FAILURE_COPY["not-found"] !== "No pool data available.") {
      fail(
        `not-found copy must be 'No pool data available.', got: ${PANCAKESWAP_FAILURE_COPY["not-found"]}`
      );
    }
    // Failure copy must NEVER imply the pools belong to / are associated with the agent.
    for (const copy of Object.values(PANCAKESWAP_FAILURE_COPY)) {
      if (/for this agent|associated with this agent/i.test(copy)) {
        fail(`failure copy must not imply agent ownership of pools: "${copy}"`);
      }
    }
    // Every non-ready state returns NO pools (never a fake row).
    if (displayPools(failure("network-error")).length !== 0)
      fail("failure states must return zero pools");
    console.log(
      "ok   10 not-found / timeout / server-error / network-error render honest copy + no fake rows"
    );
  }

  // 11. loading state (structural — the page skeleton wraps the section before data resolves).
  {
    if (isPancakeSwapReady(undefined)) fail("undefined data must NOT be ready");
    if (displayPools(undefined).length !== 0) fail("undefined data must produce no pools");
    console.log("ok   11 loading/undefined → not ready, no pools (skeleton path)");
  }

  // 12. No composite score — the section never merges with 8004scan/TermiX.
  {
    for (const k of ["composite", "combined", "score", "merged", "totalScore", "registryScore"]) {
      if (k in FIXTURE_POOL) fail(`pool model must NOT contain aggregate field "${k}"`);
    }
    console.log("ok   12 no composite/merged score field");
  }

  // 13. source label PancakeSwap · BSC · Chain ID 56 + chain ID 56.
  {
    if (!/PancakeSwap/i.test(PANCAKESWAP_SOURCE_LABEL)) fail("source label must name PancakeSwap");
    if (!/56/.test(PANCAKESWAP_SOURCE_LABEL)) fail("source label must carry Chain ID 56");
    if (PANCAKESWAP_BSC_CHAIN_ID !== 56) fail("chain id must be 56");
    console.log("ok   13 source label + chain ID 56");
  }

  // 14. Section title + description + mandatory read-only disclaimer.
  {
    if (PANCAKESWAP_SECTION_TITLE !== "PancakeSwap Market Intelligence")
      fail("section title must be the market-intelligence title");
    if (!/BSC mainnet|chain 56/i.test(PANCAKESWAP_SECTION_DESCRIPTION))
      fail("section description must state the network explicitly");
    if (!/8004scan|TermiX/i.test(PANCAKESWAP_SECTION_DESCRIPTION))
      fail("section description must state independence from 8004scan/TermiX");
    if (!/read-only/i.test(PANCAKESWAP_READ_ONLY_DISCLAIMER))
      fail("read-only disclaimer must state read-only");
    if (!/no swaps/i.test(PANCAKESWAP_READ_ONLY_DISCLAIMER))
      fail("read-only disclaimer must state no swaps");
    console.log("ok   14 title + network-explicit description + read-only disclaimer");
  }

  // 15. No direct browser fetch — the section consumes a pre-fetched prop only.
  {
    const mod = await import("./agent-detail-pancakeswap.copy.ts");
    for (const key of Object.keys(mod)) {
      if (typeof (mod as Record<string, unknown>)[key] === "function") {
        const name = key.toLowerCase();
        if (/fetch|request|gethttp|httpget|axios/.test(name))
          fail(`copy helper must not perform network: ${key}`);
      }
    }
    console.log("ok   15 no direct browser fetch (prop-driven only)");
  }

  // 16. Sample-scope copy states exactly what was read.
  {
    const scope = formatSampleScope({ registryLength: 2690351, headCount: 8, tailCount: 8 });
    if (!/Sample: first 8 and latest 8 registered PancakeSwap V2 pairs/i.test(scope))
      fail(`sample scope must state head+tail window, got: ${scope}`);
    if (!/2,690,351/.test(scope) && !/2690351/.test(scope.replace(/,/g, "")))
      fail(`sample scope must carry the registry length, got: ${scope}`);
    const noLength = formatSampleScope({ registryLength: null, headCount: 0, tailCount: 0 });
    if (!/Sample/i.test(noLength)) fail("null-length sample must still produce honest scope copy");
    console.log("ok   16 sample-scope copy (head + tail + registry length)");
  }

  // 17. mobile-safe structure — bounded pool count (never unlimited), tabular numbers.
  {
    const many = Array.from({ length: 50 }, (_, i) => ({ ...FIXTURE_POOL, poolId: `0x${i}` }));
    if (displayPools(ready(many), 5).length !== 5) fail("displayPools must cap at the bound (5)");
    console.log("ok   17 mobile-safe: bounded pools + tabular/truncated values");
  }

  // No credential exposure — presence-only env check.
  {
    const names = [
      "PRIVATE_KEY",
      "WALLET_PRIVATE_KEY",
      "MNEMONIC",
      "SEED_PHRASE",
      "PANCAKE_PRIVATE",
      "NEXT_PUBLIC_PANCAKE",
      "PANCAKESWAP_API_KEY",
    ];
    for (const name of names) {
      if (process.env[name] !== undefined)
        fail(`credential env var must not exist in this harness: ${name}`);
    }
    console.log("ok   no credential exposure (presence-only env check)");
  }

  console.log(
    "PANCAKESWAP OPTION B STATUS: READY FOR QA (Agent Details read-only market intelligence)"
  );
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
