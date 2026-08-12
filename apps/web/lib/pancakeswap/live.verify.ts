/**
 * PANCAKESWAP P4 — LIVE NODE REAL TEST (separate from the offline harnesses).
 *
 * This is the ONE optional live probe. Unlike every other pancakeswap harness
 * (which runs OFFLINE on labeled TEST FIXTURES), this file performs exactly ONE
 * bounded read-only request against the real NodeReal MegaNode PancakeSwap
 * GraphQL source — and ONLY when a server-only `PANCAKESWAP_API_KEY` is
 * configured in the environment.
 *
 * SAFETY:
 *   - If the key is absent → prints BLOCKED and exits 0 (no fake key, no call).
 *   - The key value and the authenticated URL are NEVER printed; only a masked
 *     state line is produced.
 *   - The loader used is the same server-only `getPancakeSwapPools` — read-only
 *     by construction (no wallet/signing/tx surface).
 *
 * Run (Node >= 22, type-stripping):
 *   node --experimental-strip-types apps/web/lib/pancakeswap/live.verify.ts
 * Exit: 0 on ready OR on BLOCKED (no key); 1 when a live call fails.
 */

import { getPancakeSwapPools } from "./client.ts";

async function main(): Promise<void> {
  const key = process.env.PANCAKESWAP_API_KEY;
  if (!key || key.length === 0) {
    console.log(
      "LIVE NODE REAL TEST — BLOCKED — PANCAKESWAP_API_KEY NOT CONFIGURED (no live request made)"
    );
    process.exitCode = 0;
    return;
  }

  // Exactly ONE bounded read (Free-tier conscious: minimum fixture, no loops).
  const res = await getPancakeSwapPools({ limit: 1, orderBy: "volumeUSD" });

  if (res.state === "ready") {
    const p = res.pools[0];
    console.log(
      `LIVE NODE REAL TEST — OK — endpoint masked — ${res.pools.length} pool(s) normalized`
    );
    if (p) {
      // Sanitized projection only: no URL, no key, no token addresses needed.
      console.log(
        `  sample: poolId=${p.poolId.slice(0, 10)}… symbol=${p.symbol} tvlUsd=${p.tvlUsd} volumeUsd=${p.volumeUsd} txns=${p.totalTransactions} apr=${p.apr} apy=${p.apy}`
      );
    }
    process.exitCode = 0;
  } else {
    // The loader never returns the key or the authenticated URL in messages.
    console.log(`LIVE NODE REAL TEST — ${res.state}${res.message ? ` — ${res.message}` : ""}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("LIVE NODE REAL TEST — HARNESS ERROR (no key/URL ever printed)");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
