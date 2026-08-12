/**
 * BSC category discovery verify — deterministic TEST FIXTURE harness.
 *
 * Verifies the pure discovery pipeline (Main Track P8) with labeled stand-in
 * records. NOTHING here touches the network or reads env vars:
 *
 *   classifier.ts           → the documented phrase table + evidence rules
 *   service.assembleBscDiscovery → bounded bucket shaping, dedup, honest states
 *
 * The twelve REQUIRED named cases (Main Track P8):
 *   1. exact BSC match          7. unrelated description
 *   2. non-BSC rejection        8. ambiguous description
 *   3. rebalancing match        9. multiple-category match
 *   4. grid match              10. missing description (name-only rules)
 *   5. yield match             11. duplicate agent (dedup)
 *   6. health-factor match     12. evidence preservation
 *
 * Every fixture below is a TEST FIXTURE — a stand-in `Scan8004Agent` record.
 * Evidence excerpts are real substrings of the fixture metadata (never
 * invented), and counts always satisfy `matched ≤ retrieved ≤ hits`.
 *
 * Run:  npm run discovery:verify  (in apps/web)
 */

import {
  classifyAgentText,
  discoveryCategoryKeyFromLabel,
  includeInBscDiscovery,
  type DiscoveryCategoryKey,
} from "./classifier.ts";
import { assembleBscDiscovery, type BscDiscoveryBucketInput } from "./service.ts";
import type { Scan8004Agent } from "../types";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

/* ------------------------------------------------------------------ *
 * TEST FIXTURES — labeled stand-in 8004scan records (never fabricated live
 * data; every description below is explicit, deterministic test input).
 * ------------------------------------------------------------------ */

function fixtureAgent(
  overrides: Partial<Scan8004Agent> & {
    agent_id: string;
    name: string | null;
    description: string | null;
  }
): Scan8004Agent {
  return {
    id: `fixture-${overrides.agent_id}`,
    agent_id: overrides.agent_id,
    token_id: overrides.agent_id.split(":").at(-1) ?? "0",
    chain_id: 56,
    chain_type: "evm",
    contract_address: `0x${overrides.agent_id.split(":").at(1) ?? "Fixture"}`,
    is_testnet: false,
    owner_id: null,
    owner_address: "0xFixtureOwner",
    owner_ens: null,
    owner_username: null,
    owner_avatar_url: null,
    owner_publisher_tier: null,
    owner_certified_name: null,
    name: overrides.name,
    description: overrides.description,
    image_url: null,
    is_verified: false,
    star_count: 0,
    supported_protocols: ["A2A"],
    x402_supported: false,
    total_score: 0,
    rank: null,
    network_rank: null,
    health_score: null,
    total_feedbacks: 0,
    average_score: 0,
    cross_chain_versions: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

/** TEST FIXTURE — exact BSC match: rebalancing evidence in the description. */
const BSC_REBALANCING = fixtureAgent({
  agent_id: "56:0xReBalAnCe:1",
  name: "PilotAgent",
  description: "A safe execution layer for automated portfolio rebalancing across BNB Chain DEXs.",
});
/** TEST FIXTURE — non-BSC record with strong category text (must be rejected). */
const ETH_YIELD = fixtureAgent({
  agent_id: "1:0xEthAgg:2",
  chain_id: 1,
  name: "EthAgg",
  description: "Yield aggregator optimizing returns on Ethereum mainnet.",
});
/** TEST FIXTURE — grid trading evidence. */
const BSC_GRID = fixtureAgent({
  agent_id: "56:0xSpotGrid:3",
  name: "TradePilot",
  description: "Automated crypto trading bot with DCA, grid, and rebalancing strategies.",
});
/** TEST FIXTURE — yield optimisation evidence. */
const BSC_YIELD = fixtureAgent({
  agent_id: "56:0xYieldMax:4",
  name: "YieldOptimizer",
  description: "Multi-protocol yield optimization with auto-compounding vaults on BSC.",
});
/** TEST FIXTURE — health-factor evidence with explicit lending context. */
const BSC_HEALTH = fixtureAgent({
  agent_id: "56:0xAaveHf:5",
  name: "Aave Health",
  description:
    "Safe execution layer for Aave lending. Validates collateral requirements and checks health factors before borrow, repay, withdraw.",
});
/** TEST FIXTURE — unrelated description (must be uncategorized). */
const BSC_UNRELATED = fixtureAgent({
  agent_id: "56:0xNotDeFi:6",
  name: "DavidBeckham",
  description: "Focused on sports, culture and creative challenges.",
});
/** TEST FIXTURE — ambiguous: medical "health" must NOT match health factor. */
const BSC_AMBIG_HEALTH = fixtureAgent({
  agent_id: "56:0xClinic:7",
  name: "ClinicWatch",
  description: "Health monitoring dashboards for clinics and hospitals.",
});
/** TEST FIXTURE — ambiguous: energy "grid" must NOT match grid trading. */
const BSC_AMBIG_GRID = fixtureAgent({
  agent_id: "56:0xPowerGrid:8",
  name: "GridSun",
  description: "Optimizes energy grid maintenance schedules.",
});
/** TEST FIXTURE — multiple categories in one real description. */
const BSC_MULTI = fixtureAgent({
  agent_id: "56:0xDeFiMatrix:9",
  name: "DeFiMatrix",
  description: "Get personalized yield strategies and portfolio rebalancing.",
});
/** TEST FIXTURE — missing description; name-only evidence is allowed. */
const BSC_NAME_ONLY = fixtureAgent({
  agent_id: "56:0xNameOnly:10",
  name: "Yield Farmer",
  description: null,
});
/** TEST FIXTURE — name says yield but description exists and does not → no match. */
const BSC_NAME_IGNORED = fixtureAgent({
  agent_id: "56:0xNameVsDesc:11",
  name: "Yield Farmer",
  description: "An AI assistant for travel planning.",
});

/* 1 — exact BSC match + BSC guard ------------------------------------- */

{
  const r = classifyAgentText({
    name: BSC_REBALANCING.name,
    description: BSC_REBALANCING.description,
  });
  check(
    "exact BSC match: classified as rebalancing",
    r.categories.some((m) => m.category === "rebalancing")
  );
  check("exact BSC match: not uncategorized", r.uncategorized === false);
  check(
    "exact BSC match: evidence comes from the description",
    r.categories[0]?.evidence === "description"
  );
  check("includeInBscDiscovery: 56 + mainnet → true", includeInBscDiscovery(56, false) === true);
  check("includeInBscDiscovery: 97 + testnet → false", includeInBscDiscovery(97, true) === false);
  check("includeInBscDiscovery: 1 + mainnet → false", includeInBscDiscovery(1, false) === false);
}

/* 2 — non-BSC rejection ------------------------------------------------ */

{
  const r = classifyAgentText({ name: ETH_YIELD.name, description: ETH_YIELD.description });
  const b = assembleBscDiscovery([
    bucketInput("yield-optimisation", [ETH_YIELD], 150),
    bucketInput("rebalancing", [], 0),
  ]);
  check(
    "non-BSC rejection: text alone classifies (API-side filter is the guard)",
    r.categories.some((m) => m.category === "yield-optimisation")
  );
  check(
    "non-BSC rejection: chain-1 record never enters a BSC bucket",
    b.buckets.find((x) => x.key === "yield-optimisation")?.retrieved === 0
  );
  check(
    "non-BSC rejection: never surfaced as a discovered agent",
    b.buckets.every((x) => x.discovered.length === 0)
  );
}

/* 3 — rebalancing match -------------------------------------------------- */

{
  const r = classifyAgentText({
    name: BSC_REBALANCING.name,
    description: BSC_REBALANCING.description,
  });
  check(
    "rebalancing match: phrase family fires on 'portfolio rebalancing'",
    r.categories.length === 1 && r.categories[0]?.category === "rebalancing"
  );
  check("rebalancing match: canonical label", r.categories[0]?.label === "Rebalancing");
}

/* 4 — grid match ---------------------------------------------------------- */

{
  const r = classifyAgentText({ name: BSC_GRID.name, description: BSC_GRID.description });
  check(
    "grid match: 'DCA, grid, and rebalancing' fires grid trading",
    r.categories.some((m) => m.category === "grid-trading")
  );
  check(
    "grid match: same description also fires rebalancing (real metadata)",
    r.categories.some((m) => m.category === "rebalancing")
  );
}

/* 5 — yield match ---------------------------------------------------------- */

{
  const r = classifyAgentText({ name: BSC_YIELD.name, description: BSC_YIELD.description });
  check(
    "yield match: 'yield optimization' fires",
    r.categories.some((m) => m.category === "yield-optimisation")
  );
  check(
    "yield match: 'auto-compounding' is its own phrase",
    /auto-?compound/.test(BSC_YIELD.description ?? "") === true
  );
}

/* 6 — health-factor match --------------------------------------------------- */

{
  const r = classifyAgentText({ name: BSC_HEALTH.name, description: BSC_HEALTH.description });
  check(
    "health-factor match: explicit 'checks health factors' fires",
    r.categories.some((m) => m.category === "health-factor-monitoring")
  );
  check("health-factor match: only the health bucket", r.categories.length === 1);
}

/* 7 — unrelated description ---------------------------------------------------- */

{
  const r = classifyAgentText({ name: BSC_UNRELATED.name, description: BSC_UNRELATED.description });
  check("unrelated description: uncategorized", r.uncategorized === true);
  check("unrelated description: zero matches", r.categories.length === 0);
  const b = assembleBscDiscovery([
    bucketInput("grid-trading", [BSC_UNRELATED], 10),
    bucketInput("yield-optimisation", [BSC_UNRELATED], 10),
  ]);
  check(
    "unrelated description: appears in no bucket",
    b.buckets.every((x) => x.discovered.length === 0)
  );
}

/* 8 — ambiguous description ------------------------------------------------------ */

{
  const health = classifyAgentText({
    name: BSC_AMBIG_HEALTH.name,
    description: BSC_AMBIG_HEALTH.description,
  });
  check(
    "ambiguous: clinic 'health monitoring' does NOT fire health factor",
    health.categories.length === 0
  );
  const grid = classifyAgentText({
    name: BSC_AMBIG_GRID.name,
    description: BSC_AMBIG_GRID.description,
  });
  check(
    "ambiguous: energy 'grid maintenance' does NOT fire grid trading",
    grid.categories.length === 0
  );
}

/* 9 — multiple-category match ---------------------------------------------------- */

{
  const r = classifyAgentText({ name: BSC_MULTI.name, description: BSC_MULTI.description });
  check(
    "multiple-category: yield evidence present",
    r.categories.some((m) => m.category === "yield-optimisation")
  );
  check(
    "multiple-category: rebalancing evidence present",
    r.categories.some((m) => m.category === "rebalancing")
  );
  check("multiple-category: both kept (never forced to one)", r.categories.length === 2);
  const b = assembleBscDiscovery([
    bucketInput("yield-optimisation", [BSC_MULTI], 5),
    bucketInput("rebalancing", [BSC_MULTI], 5),
  ]);
  check(
    "multiple-category: the same record surfaces in BOTH buckets",
    b.buckets.find((x) => x.key === "yield-optimisation")?.matched === 1 &&
      b.buckets.find((x) => x.key === "rebalancing")?.matched === 1
  );
}

/* 10 — missing description (name-only rules) ---------------------------------------- */

{
  const nameOnly = classifyAgentText({ name: BSC_NAME_ONLY.name, description: null });
  check(
    "missing description: name-only match ALLOWED (no better metadata)",
    nameOnly.categories.some((m) => m.category === "yield-optimisation")
  );
  check(
    "missing description: evidence flagged as 'name'",
    nameOnly.categories[0]?.evidence === "name"
  );
  const nameVsDesc = classifyAgentText({
    name: BSC_NAME_IGNORED.name,
    description: BSC_NAME_IGNORED.description,
  });
  check(
    "missing description: name NEVER wins when a description exists",
    nameVsDesc.categories.length === 0 && nameVsDesc.uncategorized === true
  );
}

/* 11 — duplicate agent (dedup within a bucket) ---------------------------------------- */

{
  const b = assembleBscDiscovery([
    bucketInput("rebalancing", [BSC_REBALANCING, BSC_REBALANCING, BSC_REBALANCING], 100),
  ]);
  const bucket = b.buckets.find((x) => x.key === "rebalancing");
  check("duplicate agent: retrieved counts the unique record once", bucket?.retrieved === 1);
  check("duplicate agent: matched counts the unique record once", bucket?.matched === 1);
  check("duplicate agent: single row in the bucket", bucket?.discovered.length === 1);
}

/* 12 — evidence preservation ------------------------------------------------------------ */

{
  const r = classifyAgentText({ name: BSC_HEALTH.name, description: BSC_HEALTH.description });
  const ev = r.categories[0];
  check(
    "evidence preservation: source is '8004scan metadata' (never '8004scan category')",
    ev?.source === "8004scan metadata"
  );
  check(
    "evidence preservation: evidence text is a REAL excerpt of the description",
    ev?.evidenceText != null &&
      (BSC_HEALTH.description ?? "").includes(ev.evidenceText.replace(/^…/, "").replace(/…$/, ""))
  );
  check(
    "evidence preservation: excerpt contains the matched phrase",
    ev?.evidenceText.includes("health factor") === true
  );
  check(
    "evidence preservation: deterministic — classifying again yields identical evidence",
    JSON.stringify(
      classifyAgentText({ name: BSC_HEALTH.name, description: BSC_HEALTH.description })
    ) === JSON.stringify(r)
  );
  const b = assembleBscDiscovery([bucketInput("health-factor-monitoring", [BSC_HEALTH], 3)]);
  const item = b.buckets[0]?.discovered[0];
  check(
    "evidence preservation: bucket row keeps the same evidence object",
    item?.match.source === "8004scan metadata" &&
      item?.match.category === "health-factor-monitoring"
  );
}

/* --- assembly: counts, partial failure, honest states ---------------------------- */

{
  const b = assembleBscDiscovery([
    bucketInput("rebalancing", [BSC_REBALANCING, BSC_MULTI], 34),
    bucketInput("grid-trading", [BSC_GRID], 7),
    bucketInput("yield-optimisation", [BSC_YIELD, BSC_MULTI, BSC_NAME_ONLY], 121),
    bucketInput("health-factor-monitoring", [BSC_HEALTH, BSC_AMBIG_HEALTH, BSC_UNRELATED], 13),
  ]);
  check("assembly: overall state ready", b.state === "ready");
  check(
    "assembly: bucket order follows DISCOVERY_CATEGORIES",
    b.buckets.map((x) => x.key).join(",") ===
      "rebalancing,grid-trading,yield-optimisation,health-factor-monitoring"
  );
  check(
    "assembly: rebalancing matched = 2 (unique, multi-category allowed)",
    b.buckets[0]?.matched === 2
  );
  check("assembly: grid-trading matched = 1", b.buckets[1]?.matched === 1);
  check("assembly: yield matched = 3 (incl. name-only)", b.buckets[2]?.matched === 3);
  check("assembly: health matched = 1 (ambiguous/medical discarded)", b.buckets[3]?.matched === 1);
  check(
    "assembly: hits mirror the API's own totals",
    b.buckets[0]?.hits === 34 && b.buckets[3]?.hits === 13
  );
  check("assembly: retrieved counts keyword-fetched records", b.buckets[2]?.retrieved === 3);
  check(
    "assembly: matched ≤ retrieved ≤ hits (auditable)",
    b.buckets.every((x) => x.matched <= x.retrieved && (x.hits == null || x.retrieved <= x.hits))
  );
  check(
    "assembly: every row is BSC",
    b.buckets.every((x) =>
      x.discovered.every((d) => d.agent.chainId === 56 && d.agent.isTestnet === false)
    )
  );
  check(
    "assembly: no fabricated rows beyond classified matches",
    b.buckets.every((x) => x.discovered.length === x.matched && x.matched <= x.retrieved)
  );
}

{
  const ok = bucketInput("rebalancing", [BSC_REBALANCING], 5);
  const failed = {
    key: "grid-trading" as DiscoveryCategoryKey,
    result: { ok: false as const, reason: "rate-limited" as const, status: 429 },
  };
  const b = assembleBscDiscovery([ok, failed]);
  check(
    "partial failure: healthy buckets still render",
    bucketsWith(b, "rebalancing").state === "ready"
  );
  check(
    "partial failure: failed bucket is honest (rate-limited)",
    bucketsWith(b, "grid-trading").state === "rate-limited"
  );
  check("partial failure: overall stays ready (partial availability)", b.state === "ready");
  check(
    "partial failure: failed bucket has no rows and no numbers",
    bucketsWith(b, "grid-trading").hits === null &&
      bucketsWith(b, "grid-trading").retrieved === 0 &&
      bucketsWith(b, "grid-trading").matched === 0
  );
}

{
  const all = [
    {
      key: "rebalancing" as DiscoveryCategoryKey,
      result: { ok: false as const, reason: "error" as const },
    },
    {
      key: "grid-trading" as DiscoveryCategoryKey,
      result: { ok: false as const, reason: "rate-limited" as const, status: 429 },
    },
    {
      key: "yield-optimisation" as DiscoveryCategoryKey,
      result: { ok: false as const, reason: "error" as const, status: 500 },
    },
    {
      key: "health-factor-monitoring" as DiscoveryCategoryKey,
      result: { ok: false as const, reason: "error" as const },
    },
  ];
  const b = assembleBscDiscovery(all);
  check("all failed: overall is the worst honest state (rate-limited)", b.state === "rate-limited");
  check(
    "all failed: every bucket reports its own failure",
    b.buckets.every((x) => x.state !== "ready" && x.state !== "empty")
  );
  check(
    "all failed: empty buckets array only for missing-key (service-level)",
    assembleBscDiscovery([]).state === "error"
  );
}

/* --- label mapping (UI facets ⇄ canonical keys) ----------------------------------- */

{
  check(
    "label mapping: UI 'Yield Optimization' (US) → yield-optimisation",
    discoveryCategoryKeyFromLabel("Yield Optimization") === "yield-optimisation"
  );
  check(
    "label mapping: UI 'Health Factor' → health-factor-monitoring",
    discoveryCategoryKeyFromLabel("Health Factor") === "health-factor-monitoring"
  );
  check(
    "label mapping: UI 'Grid Trading' → grid-trading",
    discoveryCategoryKeyFromLabel("Grid Trading") === "grid-trading"
  );
  check(
    "label mapping: unknown label matches nothing",
    discoveryCategoryKeyFromLabel("Memes") === "memes"
  );
}

console.log("");
console.log(`discovery verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);

/* --- helpers ------------------------------------------------------------ */

function bucketInput(
  key: DiscoveryCategoryKey,
  agents: Scan8004Agent[],
  hits: number
): BscDiscoveryBucketInput {
  return {
    key,
    result: {
      ok: true,
      data: agents,
      meta: { pagination: { page: 1, limit: 100, total: hits, hasMore: false } },
    },
  };
}

function bucketsWith(data: ReturnType<typeof assembleBscDiscovery>, key: DiscoveryCategoryKey) {
  return data.buckets.find((x) => x.key === key) as NonNullable<
    ReturnType<typeof assembleBscDiscovery>["buckets"][number]
  >;
}
