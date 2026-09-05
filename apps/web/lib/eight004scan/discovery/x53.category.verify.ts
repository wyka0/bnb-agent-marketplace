/**
 * X.53 Main Track category-depth verifier.
 *
 * Proves the four required categories are genuinely wired to real registry
 * data and that none of them fabricates metrics. Pure/offline: the discovery
 * assembly is exercised with TEST FIXTURE records (no network, no env, no
 * database, no chain access).
 */

import { readFileSync } from "node:fs";
import { assembleBscDiscovery, type BscDiscoveryBucketInput } from "./service.ts";
import { DISCOVERY_CATEGORIES, type DiscoveryCategoryKey } from "./classifier.ts";
import type { Scan8004Agent } from "../types.ts";

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

/** Minimal real-shaped registry record (chain 56, mainnet-listed, non-testnet). */
function record(
  overrides: Partial<Scan8004Agent> & { id: string; agent_id: string }
): Scan8004Agent {
  return {
    id: overrides.id,
    agent_id: overrides.agent_id,
    token_id: overrides.token_id ?? "1",
    chain_id: overrides.chain_id ?? 56,
    chain_type: overrides.chain_type ?? "evm",
    contract_address: overrides.contract_address ?? "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
    is_testnet: overrides.is_testnet ?? false,
    owner_id: null,
    owner_address: overrides.owner_address ?? null,
    owner_ens: null,
    owner_username: null,
    owner_avatar_url: null,
    owner_publisher_tier: null,
    owner_certified_name: null,
    name: overrides.name ?? null,
    description: overrides.description ?? null,
    image_url: null,
    is_verified: overrides.is_verified ?? false,
    star_count: overrides.star_count ?? 0,
    supported_protocols: overrides.supported_protocols ?? [],
    x402_supported: overrides.x402_supported ?? false,
    total_score: overrides.total_score ?? 0,
    rank: null,
    network_rank: null,
    health_score: overrides.health_score ?? null,
    total_feedbacks: overrides.total_feedbacks ?? 0,
    average_score: overrides.average_score ?? 0,
    cross_chain_versions: null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-02T00:00:00.000Z",
  };
}

function okResult(rows: Scan8004Agent[], total: number): BscDiscoveryBucketInput["result"] {
  return {
    ok: true,
    data: rows,
    meta: { pagination: { page: 1, limit: 100, total, hasMore: false } },
  };
}

const CATEGORY_PAGES: ReadonlyArray<{ key: DiscoveryCategoryKey; path: string }> = [
  { key: "rebalancing", path: "app/(app)/categories/rebalancing/page.tsx" },
  { key: "grid-trading", path: "app/(app)/categories/grid-trading/page.tsx" },
  { key: "yield-optimisation", path: "app/(app)/categories/yield/page.tsx" },
  { key: "health-factor-monitoring", path: "app/(app)/categories/health-factor/page.tsx" },
];

async function main(): Promise<void> {
  const dashboard = read("components/category-dashboard.tsx");

  // 1-4. All four categories are wired to the shared real-data dashboard.
  {
    const sources = CATEGORY_PAGES.map(({ path }) => read(path));
    check(
      "all four category pages render the shared data-backed dashboard",
      sources.every((src) => src.includes("CategoryDashboard"))
    );
    check(
      "all four category pages declare their discovery key",
      CATEGORY_PAGES.every(({ key, path }) => read(path).includes(`discoveryKey: "${key}"`))
    );
    check(
      "no category page renders a 'coming soon' placeholder",
      sources.every((src) => !/coming soon/i.test(src)) && !/coming soon/i.test(dashboard)
    );
    check(
      "no category page hardcodes em-dash metric values",
      sources.every((src) => !/value:\s*"—"/.test(src))
    );
  }

  // 5-7. Equal depth: every category supplies capability + decision signals.
  {
    const parsed = CATEGORY_PAGES.map(({ path }) => read(path));
    check(
      "every category states its capability",
      parsed.every((src) => /capability:\s*\n?\s*"/.test(src) || src.includes("capability:"))
    );
    check(
      "every category lists decision signals for activation review",
      parsed.every((src) => src.includes("decisionSignals"))
    );
    const signalCounts = parsed.map((src) => (src.match(/^\s{10}"/gm) ?? []).length);
    check(
      "every category provides multiple decision signals (equal depth)",
      signalCounts.every((count) => count >= 4),
      `counts=${signalCounts.join(",")}`
    );
  }

  // 8-10. Category membership is inferred from real metadata, with evidence.
  {
    const rows = [
      record({
        id: "1",
        agent_id: "56:0xabc:1",
        name: "Vault Keeper",
        description: "Automated portfolio rebalancing for LP positions.",
      }),
      record({
        id: "2",
        agent_id: "56:0xabc:2",
        name: "Unrelated",
        description: "A generic analytics dashboard.",
      }),
    ];
    const assembled = assembleBscDiscovery([{ key: "rebalancing", result: okResult(rows, 2) }]);
    const bucket = assembled.buckets[0];
    check(
      "real matching record is classified into its category",
      bucket?.matched === 1 && bucket.state === "ready"
    );
    check(
      "non-matching record is excluded (no guessing)",
      bucket?.retrieved === 2 && bucket.matched === 1
    );
    const evidence = bucket?.discovered[0]?.match;
    check(
      "each match keeps real registry evidence and honest source framing",
      evidence?.source === "8004scan metadata" &&
        typeof evidence?.evidenceText === "string" &&
        evidence.evidenceText.length > 0
    );
  }

  // 11-12. Counts stay auditable; BSC mainnet + BSC testnet rows are included
  // (X.154) while other chains are excluded.
  {
    const rows = [
      record({
        id: "3",
        agent_id: "56:0xabc:3",
        description: "Yield optimizer with auto-compounding.",
      }),
      record({
        id: "4",
        agent_id: "97:0xabc:4",
        chain_id: 97,
        is_testnet: true,
        description: "Yield optimizer on testnet.",
      }),
      record({
        id: "5",
        agent_id: "1:0xabc:5",
        chain_id: 1,
        is_testnet: false,
        description: "Yield optimizer on another chain.",
      }),
    ];
    const bucket = assembleBscDiscovery([{ key: "yield-optimisation", result: okResult(rows, 9) }])
      .buckets[0];
    check(
      "matched never exceeds retrieved, retrieved never exceeds registry hits",
      bucket !== undefined &&
        bucket.matched <= bucket.retrieved &&
        bucket.retrieved <= (bucket.hits ?? Infinity),
      `matched=${bucket?.matched} retrieved=${bucket?.retrieved} hits=${bucket?.hits}`
    );
    check("BSC mainnet + BSC testnet included; other chains excluded", bucket?.retrieved === 2);
    check("BSC testnet records classify into their category", bucket?.matched === 2);
  }

  // 13-15. Honest failure and empty states, never a fabricated agent.
  {
    const failed = assembleBscDiscovery([
      { key: "grid-trading", result: { ok: false, reason: "rate-limited", status: 429 } },
    ]);
    check(
      "registry failure degrades to an honest state with zero rows",
      failed.buckets[0]?.state === "rate-limited" && failed.buckets[0]?.discovered.length === 0
    );
    const empty = assembleBscDiscovery([{ key: "grid-trading", result: okResult([], 0) }]);
    check(
      "a successful query with no match reports 'empty', not a placeholder",
      empty.buckets[0]?.state === "empty" && empty.buckets[0]?.matched === 0
    );
    check(
      "dashboard distinguishes real failure states from empty results",
      dashboard.includes("missing-key") &&
        dashboard.includes("rate-limited") &&
        dashboard.includes("Registry temporarily unavailable")
    );
  }

  // 16-18. Data honesty in the rendered dashboard.
  {
    check(
      "dashboard attributes its source and retrieval timestamp",
      dashboard.includes("Agent source: 8004scan registry") &&
        dashboard.includes("retrieved") &&
        dashboard.includes("fetchedAt")
    );
    check(
      "dashboard states category is inferred, not a registry field",
      /inferred\s+from\s+registry\s+metadata/i.test(dashboard)
    );
    check(
      "dashboard invents no APY/health-factor/grid metric",
      !/\bAPY\b\s*[:=]\s*["'\d]|healthFactor\s*[:=]\s*\d|gridLevels\s*[:=]\s*\d/.test(dashboard)
    );
  }

  // 19-20. Consistent activation journey + registry vocabulary alignment.
  {
    check(
      "every category links into the agent page for capability/permission review",
      dashboard.includes("/agents/") &&
        /review capability, permissions and activation/i.test(dashboard)
    );
    check(
      "category discovery keys match the shared classifier vocabulary",
      CATEGORY_PAGES.every(({ key }) =>
        DISCOVERY_CATEGORIES.some((candidate) => candidate.key === key)
      )
    );
  }

  // 21. TermiX evidence container exists with the required structure.
  // X.57: real measurements were recorded, so the "no results yet" banner is
  // legitimately gone. The invariant is now that the report is evidence-BACKED:
  // 3 tasks, all four measures, and a real security task.
  {
    const report = read("../../docs/termix/Agent-Advantage-Report.md");
    const hasThreeTasks =
      /## Task 1/.test(report) && /## Task 2/.test(report) && /## Task 3/.test(report);
    const measuresAll =
      /Elapsed/.test(report) &&
      /Cost/.test(report) &&
      /Quality/.test(report) &&
      /Evidence/.test(report);
    const securityTask = /security/i.test(report);
    // Either the untouched template, or a run backed by real evidence files.
    const evidenceBacked =
      /REAL MEASUREMENTS RECORDED/.test(report) && /evidence\/task-01/.test(report);
    const stillTemplate = /NO RESULTS RECORDED YET/.test(report);
    check(
      "TermiX Agent Advantage report has 3 tasks, all measures, and is either an unfilled template or evidence-backed",
      hasThreeTasks && measuresAll && securityTask && (evidenceBacked || stillTemplate)
    );
  }

  console.log(
    `X.53 CATEGORY VERIFIER: ${checks} checks, ${failures} failures — ${failures === 0 ? "ALL PASS" : "FAILURES PRESENT"}`
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(
    `X.53 BLOCKED — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`
  );
  process.exitCode = 1;
});
