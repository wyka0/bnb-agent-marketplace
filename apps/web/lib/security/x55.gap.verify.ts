/**
 * X.55 product gap-closure verifier.
 *
 * Covers only what X.55 actually changed or claims:
 *  - the Prisma engine relocation (deployment defect fix)
 *  - misconfiguration mapped to 503 instead of a misleading generic 500
 *  - the new public x402 requirement selector (pure, offline, chain-97 pinned)
 *  - the standing refusal to invent APR/APY, 24h volume, or health factors
 *  - the TermiX evidence template's required structure
 *
 * Pure/offline: no network, no database, no KMS, no chain access.
 */

import { readFileSync } from "node:fs";
import {
  parsePaymentRequired,
  selectPaymentRequirement,
} from "@bnb-marketplace/integrations/altana";
import { altanaApiErrorMessage } from "../altana-session/api.ts";
import { buildCategoryMarketContext } from "../categories/market-context.ts";
import type { PancakeSwapPoolsData } from "../pancakeswap/client.ts";

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

/**
 * A structurally valid chain-97 402 challenge.
 *
 * Rail is expressed the way the SDK actually resolves it: either the standard
 * `extra.assetTransferMethod` ("permit2-exact"), or the legacy `scheme`
 * ("permit2" / "exact"). A bare `scheme: "permit2-exact"` is NOT resolvable —
 * verified against the SDK's own `resolveRail` implementation.
 */
const CHALLENGE_97 = {
  x402Version: 1,
  resource: "https://example.test/paid",
  accepts: [
    {
      scheme: "permit2",
      network: "bnb-testnet",
      maxAmountRequired: "1000",
      asset: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
      payTo: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
      resource: "https://example.test/paid",
      description: "test resource",
      mimeType: "application/json",
      maxTimeoutSeconds: 60,
      extra: { assetTransferMethod: "permit2-exact" },
    },
  ],
};

async function main(): Promise<void> {
  // 1-4. Prisma engine relocation (the X.54 local 500 root cause).
  {
    const schema = read("../../prisma/schema.prisma");
    const client = read("../../prisma/src/client.ts");
    check("Prisma generator emits into the workspace package", /output\s*=\s*"\.\.\/prisma\/generated\/client"/.test(schema));
    check("server client imports the workspace-generated client", client.includes("../generated/client/index.js"));
    check("Prisma client remains server-only after relocation", client.includes('import "server-only"'));
    let engineTraced = false;
    try {
      engineTraced = readFileSync("../../prisma/generated/client/query_engine-windows.dll.node").byteLength > 0;
    } catch {
      engineTraced = false;
    }
    check("native query engine is generated on a traceable workspace path", engineTraced);
  }

  // 5-7. Error classification: misconfiguration is 503, not a generic 500.
  {
    const misconfig = altanaApiErrorMessage(new Error("X.45 server entry: missing required environment variable ALTANA_TESTNET_PRIVATE_KEY."));
    check("missing configuration maps to 503 unavailable", misconfig.status === 503);
    check("misconfiguration message never names the variable or leaks internals", !/ALTANA_TESTNET_PRIVATE_KEY|environment variable/i.test(misconfig.message));
    const dbDown = altanaApiErrorMessage(new Error("P1001 can't reach database server"));
    const unknown = altanaApiErrorMessage(new Error("TypeError: boom at internal.js:1:1"));
    check("database failure stays 503 and unknown failure stays generic 500", dbDown.status === 503 && unknown.status === 500 && unknown.message === "Unable to complete the session request.");
  }

  // 8-12. New public x402 requirement selector (closes a real gap).
  {
    const parsed = parsePaymentRequired(CHALLENGE_97);
    check("402 challenge parses into requirements", parsed.ok === true && parsed.requirements.length === 1);
    if (parsed.ok) {
      const selected = selectPaymentRequirement(parsed.requirements);
      check("a chain-97 requirement can now be selected publicly", selected.ok === true);
      const mainnet = selectPaymentRequirement(parsed.requirements, { network: 56 });
      check("mainnet selection is refused (chain 97 only)", mainnet.ok === false && /mainnet|not enabled|Unsupported/i.test(mainnet.reason));
      const unknownChain = selectPaymentRequirement(parsed.requirements, { network: 1234 });
      check("unknown chain selection is refused", unknownChain.ok === false);
    }
    const empty = selectPaymentRequirement([]);
    check("empty requirement list is refused rather than guessed", empty.ok === false && /at least one/i.test(empty.reason));
  }

  // 13-14. Selector crosses no execution boundary.
  {
    const source = read("../../packages/integrations/src/altana/x402.ts");
    const fn = source.slice(source.indexOf("export function selectPaymentRequirement"));
    const body = fn.slice(0, fn.indexOf("\n}\n") + 3);
    check("selector performs no signing, submitting, or network call", !/fetch\(|sign|submit|broadcast|privateKey|session\./i.test(body));
    check("buyer/sell-side execution boundaries remain intact", source.includes("X402_EXECUTION_REQUIRES_SESSION") && source.includes("assertX402SellSideBoundary"));
  }

  // 15-18. Standing refusal to fabricate unavailable metrics.
  {
    const ready: PancakeSwapPoolsData = {
      state: "ready",
      pools: [
        {
          poolId: "0x1",
          chainId: 56,
          token0Address: "0xa",
          token0Symbol: "WBNB",
          token1Address: "0xb",
          token1Symbol: "CAKE",
          symbol: "WBNB/CAKE",
          tvlUsd: 1_000_000,
          volumeUsd: 4_000_000,
          token0Price: 2.5,
          token1Price: 0.4,
          totalTransactions: 1_234,
          apr: null,
          apy: null,
          source: "pancakeswap-v2-subgraph" as never,
          retrievedAt: "2026-08-15T10:00:00.000Z",
        },
      ],
      source: "pancakeswap-v2-subgraph" as never,
      chainId: 56,
      retrievedAt: "2026-08-15T10:00:00.000Z",
    };
    const yieldCtx = buildCategoryMarketContext("yield-optimisation", ready);
    check("APR/APY remains unavailable with a stated reason", yieldCtx.state === "ready" && yieldCtx.signals.some((s) => s.label === "Yield (APR / APY)" && s.value === null && (s.unavailableReason ?? "").length > 0));
    check("24h volume remains declared unavailable", yieldCtx.unavailable.some((m) => m.label === "24h volume"));
    const healthCtx = buildCategoryMarketContext("health-factor-monitoring", ready);
    check("health factor is never synthesized", healthCtx.state === "ready" && healthCtx.pools.length === 0 && healthCtx.unavailable.some((m) => m.label === "Health factor"));
    check("no lending data source is claimed anywhere in market context", !/getUserAccountData|healthFactor\s*[:=]\s*\d|liquidationThreshold\s*[:=]\s*\d/.test(read("lib/categories/market-context.ts")));
  }

  // 19-20. Category UX guarantees hold after X.55 edits.
  {
    const dashboard = read("components/category-dashboard.tsx");
    const pages = [
      "app/(app)/categories/rebalancing/page.tsx",
      "app/(app)/categories/grid-trading/page.tsx",
      "app/(app)/categories/yield/page.tsx",
      "app/(app)/categories/health-factor/page.tsx",
    ].map(read);
    check("no category reintroduces 'coming soon' or fake metrics", pages.every((src) => !/coming soon/i.test(src) && !/value:\s*"—"/.test(src)) && !/coming soon/i.test(dashboard));
    check("every category keeps analysis-only labelling and an activation path", pages.every((src) => src.includes('executionMode: "analysis-only"')) && dashboard.includes("/agents/"));
  }

  // 21-22. TermiX report structure + evidence integrity.
  // X.57: real measurements exist now, so assert the report is either an
  // unfilled template OR backed by real evidence artifacts — never a report
  // that claims results without an evidence trail.
  {
    const report = read("../../docs/termix/Agent-Advantage-Report.md");
    const tasks = /## Task 1/.test(report) && /## Task 2/.test(report) && /## Task 3/.test(report);
    const arms = (report.match(/[Bb]aseline/g) ?? []).length >= 3 && (report.match(/[Mm]arketplace agent/g) ?? []).length >= 3;
    const measures = /Elapsed|Time/.test(report) && /Cost/.test(report) && /Quality/.test(report) && /Evidence/.test(report);
    check("TermiX report records 3 tasks x 2 arms with all four measures", tasks && arms && measures);
    const stillTemplate = /NO RESULTS RECORDED YET/.test(report);
    const evidenceBacked = /REAL MEASUREMENTS RECORDED/.test(report) && /evidence\/QUALITY-SCORING\.json|evidence\/task-01/.test(report);
    check("TermiX report is either unfilled or evidence-backed (never unsupported claims)", (stillTemplate || evidenceBacked) && /security/.test(report));
  }

  console.log(`X.55 GAP-CLOSURE VERIFIER: ${checks} checks, ${failures} failures — ${failures === 0 ? "ALL PASS" : "FAILURES PRESENT"}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(`X.55 BLOCKED — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
