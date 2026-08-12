/**
 * P9 AUDIT — read-only inspection of live BSC category candidates.
 *
 * NOT production code: nothing imports this file; it is a one-shot audit tool
 * for Main Track P9. It exercises ONLY the approved read-only verification
 * surface (`listAgents`, keyless-safe anonymous tier) — no transactions, no
 * paid services, no arbitrary endpoints, no credentials printed, no env
 * changes, no source of truth changes.
 *
 * Bounded: 4 keyword requests (the P8 discovery pass) + up to 1 exact
 * agent_id lookup per candidate = ≤ 10 requests, single page each (limit 100
 * keyword / 20 lookup). The full registry is never enumerated.
 *
 * Candidates are located BY LIVE REGISTRY IDENTITY inside the P8 discovery
 * buckets (never hardcoded into any production path); the full identity
 * record is then fetched via an exact `search=<agent_id>` round-trip.
 *
 * Run (audit only):  node --experimental-strip-types lib/eight004scan/discovery/p9-audit.ts
 */

import { listAgents } from "../client.ts";
import { pickAgentBySlug } from "../marketplace.ts";
import { normalizeAgents } from "../normalize.ts";
import { classifyAgentText } from "./classifier.ts";
import { assembleBscDiscovery, BSC_DISCOVERY_CHAIN_ID } from "./service.ts";
import { DISCOVERY_CATEGORIES } from "./classifier.ts";

const CANDIDATE_NAMES = [
  "TradePilot.agent",
  "DeFiBot.agent",
  "Aave powered by HeyAnon",
  "RiskOracle.agent",
];

console.log(
  `P9 audit: bounded discovery pass (${DISCOVERY_CATEGORIES.length} keyword requests, chainId=${BSC_DISCOVERY_CHAIN_ID})`
);

const inputs = await Promise.all(
  DISCOVERY_CATEGORIES.map(async ({ key, searchKeyword }) => ({
    key,
    result: await listAgents({
      page: 1,
      limit: 100,
      chainId: BSC_DISCOVERY_CHAIN_ID,
      isTestnet: false,
      search: searchKeyword,
    }),
  }))
);

const data = assembleBscDiscovery(inputs);

console.log("\n-- live bucket table (P8 surface) --");
for (const b of data.buckets) {
  console.log(
    `  ${b.label.padEnd(26)} hits=${String(b.hits).padEnd(4)} retrieved=${String(b.retrieved).padEnd(3)} matched=${b.matched}  state=${b.state}`
  );
}

for (const key of ["grid-trading", "health-factor-monitoring"]) {
  const bucket = data.buckets.find((b) => b.key === key);
  console.log(`\n-- ${bucket?.label} bucket: matched records --`);
  for (const d of bucket?.discovered ?? []) {
    console.log(`  ${d.agent.slug}  ${d.agent.name}`);
    console.log(`    evidence[${d.match.evidence}] ${d.match.evidenceText}`);
  }
}

console.log("\n-- candidate identity round-trips (exact agent_id lookup) --");
for (const name of CANDIDATE_NAMES) {
  // Locate the candidate inside the live discovery buckets by name.
  const located = data.buckets.flatMap((b) => b.discovered).find((d) => d.agent.name === name);

  if (!located) {
    console.log(`\n  ${name}: NOT FOUND in the bounded discovery buckets`);
    continue;
  }

  const id = located.agent.slug;
  const lookup = await listAgents({
    search: id,
    page: 1,
    limit: 20,
    chainId: BSC_DISCOVERY_CHAIN_ID,
    isTestnet: false,
  });

  if (!lookup.ok) {
    console.log(`\n  ${name} (${id}): lookup failed — ${lookup.reason}`);
    continue;
  }

  const exact = pickAgentBySlug(normalizeAgents(lookup.data), id);
  const record = lookup.data.find((r) => r.agent_id === id);

  if (!record) {
    console.log(
      `\n  ${name} (${id}): exact identity not returned (search fuzzy) — ${lookup.data.map((r) => r.agent_id).join(", ")}`
    );
    continue;
  }

  const r = classifyAgentText({ name: record.name, description: record.description });

  console.log(`\n  ${record.name}`);
  console.log(`    agent_id        ${record.agent_id}`);
  console.log(
    `    chain_id        ${record.chain_id} (${record.chain_type}, testnet=${record.is_testnet})`
  );
  console.log(`    token_id        ${record.token_id}`);
  console.log(`    contract        ${record.contract_address}`);
  console.log(
    `    owner           ${record.owner_address ?? "none"}${record.owner_username ? ` (${record.owner_username})` : ""}${record.owner_certified_name ? ` certified:${record.owner_certified_name}` : ""}`
  );
  console.log(`    verified        ${record.is_verified}`);
  console.log(
    `    protocols       ${record.supported_protocols.length > 0 ? record.supported_protocols.join(", ") : "none declared"}`
  );
  console.log(`    x402_supported  ${record.x402_supported}`);
  console.log(`    total_score     ${record.total_score}`);
  console.log(`    health_score    ${record.health_score}`);
  console.log(`    average_score   ${record.average_score}  feedback ${record.total_feedbacks}`);
  console.log(`    created_at      ${record.created_at}`);
  console.log(`    description     ${record.description ?? "null"}`);
  console.log(
    `    categories      ${r.categories.length > 0 ? r.categories.map((m) => `${m.category}[${m.evidence}]"${m.evidenceText}"`).join(" | ") : "none (uncategorized)"}`
  );
  console.log(`    id round-trip   exact (${(exact !== undefined).toString()})`);
}
