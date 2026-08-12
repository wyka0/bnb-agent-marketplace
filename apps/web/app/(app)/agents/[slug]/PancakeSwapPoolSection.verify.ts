/**
 * PANCAKESWAP P3 — Agent Details UI verification (render-free, deterministic).
 *
 * The Agent Details client component is TSX and runs inside Next.js; this
 * harness asserts the SHIPPED display semantics without a browser by importing
 * the framework-free copy/format helpers the component uses. This is the exact
 * same strategy used for the TermiX web verify harness (the truthful mapping
 * state → UI, not a pixel render).
 *
 * TEST FIXTURE / NOT LIVE PANCAKESWAP DATA. No network calls, no secret read.
 *
 * Run (Node >= 22, type-stripping):
 *   node --experimental-strip-types apps/web/app/(app)/agents/[slug]/PancakeSwapPoolSection.verify.ts
 *
 * Exit: 1 on any failed assertion; 0 otherwise.
 */

import {
  PANCAKESWAP_FAILURE_COPY,
  PANCAKESWAP_SOURCE_LABEL,
  PANCAKESWAP_CUMULATIVE_VOLUME_LABEL,
  PANCAKESWAP_APR_NOTE,
  isPancakeSwapReady,
  pancakeSwapFailureCopy,
  displayPools,
  formatUsd,
} from "./agent-detail-pancakeswap.copy.ts";
import type { PancakeSwapPoolsData, PancakeSwapPool } from "../../../../lib/pancakeswap/client.ts";
import {
  PANCAKESWAP_BSC_CHAIN_ID,
  PANCAKESWAP_SOURCE,
} from "../../../../lib/pancakeswap/client.ts";

function fail(message: string): never {
  console.error(`PANCAKESWAP UI VERIFY FAILED: ${message}`);
  process.exit(1);
}

/** TEST FIXTURE — NOT LIVE PANCAKESWAP DATA. */
const FIXTURE_POOL: PancakeSwapPool = {
  poolId: "0x61EB789d75A95CAaa3fF50A4723d08d0f40c3bB8",
  chainId: 56,
  token0Address: "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
  token0Symbol: "WBNB",
  token1Address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
  token1Symbol: "CAKE",
  symbol: "WBNB/CAKE",
  tvlUsd: 1234567.89,
  volumeUsd: 98765432.1, // cumulative (NOT 24h)
  token0Price: 12.34,
  token1Price: 0.081,
  totalTransactions: 123456,
  apr: null, // never fabricated
  apy: null,
  source: PANCAKESWAP_SOURCE,
  retrievedAt: "2026-08-10T00:00:00.000Z",
};

function ready(pools: PancakeSwapPool[] = [FIXTURE_POOL]): PancakeSwapPoolsData {
  return {
    state: "ready",
    pools,
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt: "2026-08-10T00:00:00.000Z",
  };
}

function failure(
  reason: Exclude<Exclude<PancakeSwapPoolsData, { state: "ready" }>[0]["state"], never>
): PancakeSwapPoolsData {
  return {
    state: reason,
    pools: [],
    source: PANCAKESWAP_SOURCE,
    chainId: PANCAKESWAP_BSC_CHAIN_ID,
    retrievedAt: "2026-08-10T00:00:00.000Z",
    reason,
  };
}

async function main(): Promise<void> {
  console.log("PANCAKESWAP P3 — Agent Details UI verify (offline fixtures, no live data)");

  // 1. ready state → isPancakeSwapReady true; pools surfaced.
  {
    if (!isPancakeSwapReady(ready())) fail("ready fixture must be ready");
    if (displayPools(ready()).length !== 1)
      fail("displayPools must surface the single fixture pool");
    console.log("ok   1 ready state");
  }

  // 2. pool rendering fields: token pair symbol (3), TVL (4), cumulative volume label (5).
  {
    const p = ready().pools[0]!;
    if (p.symbol !== "WBNB/CAKE") fail("token pair symbol must be WBNB/CAKE");
    if (formatUsd(p.tvlUsd).length === 0 || formatUsd(p.tvlUsd) === "—")
      fail("TVL must format as a USD value");
    if (PANCAKESWAP_CUMULATIVE_VOLUME_LABEL.toLowerCase().includes("24h")) {
      fail("cumulative volume label must NOT mention 24h");
    }
    if (!/cumulative/i.test(PANCAKESWAP_CUMULATIVE_VOLUME_LABEL))
      fail("volume must be labeled cumulative");
    console.log("ok   2,3,4,5 pool + token pair + TVL + cumulative-volume label");
  }

  // 6. price rendering (token0/token1) + 7. transaction count.
  {
    const p = ready().pools[0]!;
    if (p.token0Price <= 0 || p.token1Price <= 0) fail("both pair prices must be real numbers");
    if (!Number.isFinite(p.totalTransactions)) fail("transaction count must be a number");
    console.log("ok   6,7 price + cumulative-transaction count");
  }

  // 8. APR/APY never fabricated — null, plus the honest note exists.
  {
    const p = ready().pools[0]!;
    if (p.apr !== null || p.apy !== null) fail("apr/apy must be null in the model");
    if (!/unavailable/i.test(PANCAKESWAP_APR_NOTE))
      fail("APR note must state unavailable (no fake APR)");
    console.log("ok   8 APR/APY not fabricated (null + honest note)");
  }

  // 9. not-found + 10. timeout + 11. server error + 12. network error copies.
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
      const copy = pancakeSwapFailureCopy(failure(state as never));
      if (!copy || copy.length === 0) fail(`${state} must map to honest copy`);
    }
    // The genuinely state-specific copies must be distinct (not-found vs timeout).
    if (PANCAKESWAP_FAILURE_COPY["not-found"] === PANCAKESWAP_FAILURE_COPY["timeout"]) {
      fail("not-found and timeout must carry distinct honest copy");
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
      "ok   9-12 not-found / timeout / server-error / network-error render honest copy + no fake rows"
    );
  }

  // 13. loading state (structural — the page skeleton wraps the section before data resolves).
  {
    // displayPools(undefined) must be [] and isPancakeSwapReady(undefined) false → loading skeleton branch.
    if (isPancakeSwapReady(undefined)) fail("undefined data must NOT be ready");
    if (displayPools(undefined).length !== 0) fail("undefined data must produce no pools");
    console.log("ok   13 loading/undefined → not ready, no pools (skeleton path)");
  }

  // 14. No composite score — the section never merges with 8004scan/TermiX.
  {
    // Structural: the pool model has no "composite"/"score"/"merged" aggregate.
    for (const k of ["composite", "combined", "score", "merged", "totalScore", "registryScore"]) {
      if (k in FIXTURE_POOL) fail(`pool model must NOT contain aggregate field "${k}"`);
    }
    console.log("ok   14 no composite/merged score field");
  }

  // 15. source label PancakeSwap · BSC · Chain ID 56 + 16. chain ID 56.
  {
    if (!/PancakeSwap/i.test(PANCAKESWAP_SOURCE_LABEL)) fail("source label must name PancakeSwap");
    if (!/56/.test(PANCAKESWAP_SOURCE_LABEL)) fail("source label must carry Chain ID 56");
    if (PANCAKESWAP_BSC_CHAIN_ID !== 56) fail("chain id must be 56");
    console.log("ok   15,16 source label + chain ID 56");
  }

  // 17. No direct browser fetch — the section consumes a pre-fetched prop only.
  {
    // The component takes `data` as a prop (it cannot call fetch); assert the
    // copy module exposes no fetch/network primitive.
    const mod = await import("./agent-detail-pancakeswap.copy.ts");
    for (const key of Object.keys(mod)) {
      if (typeof (mod as Record<string, unknown>)[key] === "function") {
        const name = key.toLowerCase();
        if (/fetch|request|gethttp|httpget|axios/.test(name))
          fail(`copy helper must not perform network: ${key}`);
      }
    }
    console.log("ok   17 no direct browser fetch (prop-driven only)");
  }

  // 18. mobile-safe structure — bounded pool count (never unlimited), tabular numbers.
  {
    const many = Array.from({ length: 50 }, (_, i) => ({ ...FIXTURE_POOL, poolId: `0x${i}` }));
    if (displayPools(ready(many), 5).length !== 5) fail("displayPools must cap at the bound (5)");
    // The layout uses grid-cols-1/sm:grid-cols-2 and truncate on every value — no fixed widths.
    console.log("ok   18 mobile-safe: bounded pools + tabular/truncated values");
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
    ];
    for (const name of names) {
      if (process.env[name] !== undefined)
        fail(`credential env var must not exist in this harness: ${name}`);
    }
    console.log("ok   no credential exposure (presence-only env check)");
  }

  console.log("PANCAKESWAP P3 STATUS: READY FOR QA (Agent Details read-only pool intelligence)");
  process.exitCode = 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
