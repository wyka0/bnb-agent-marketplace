/**
 * Live BSC category discovery verify — ONE bounded, read-only pass.
 *
 * Runs the REAL request path end-to-end against the 8004scan public anonymous
 * tier (keyless-safe client, mirroring marketplace:live:verify):
 *
 *   listAgents({ search:<keyword>, chainId:56, isTestnet:false, limit:100 })
 *     → assembleBscDiscovery (pure) → real per-category buckets + evidence
 *
 * Boundedness (Main Track P8): exactly 4 requests (one per required category
 * keyword), single page each, limit ≤ 100. The 404,853-agent registry is
 * NEVER enumerated. No credentials are ever printed; no records are
 * fabricated — every surfaced agent is a real 8004scan record whose match
 * evidence is a real excerpt of its metadata.
 *
 * Offline / error / rate-limited API responses are honest outcomes of the
 * state design and exit 0 (states are verified, not data presence). The
 * script only fails on contradictions: fabricated rows, evidence not in the
 * metadata, non-BSC records, or broken `matched ≤ retrieved ≤ hits`.
 *
 * Run:  npm run discovery:live:verify  (in apps/web)
 */

import { listAgents } from "../client.ts";
import { classifyAgent } from "./classifier.ts";
import {
  assembleBscDiscovery,
  BSC_DISCOVERY_CHAIN_ID,
  type BscDiscoveryBucketInput,
} from "./service.ts";
import { DISCOVERY_CATEGORIES } from "./classifier.ts";

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

console.log(
  `discovery live verify: one bounded pass, ${DISCOVERY_CATEGORIES.length} keyword requests (chainId=${BSC_DISCOVERY_CHAIN_ID})`
);

const inputs: BscDiscoveryBucketInput[] = await Promise.all(
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

check("data has an honest state", typeof data.state === "string" && data.state.length > 0);

const usable = data.buckets.filter((b) => b.state === "ready" || b.state === "empty");
if (usable.length === 0) {
  console.log("  note: every category request failed (honest states, no fabricated data) —");
  for (const b of data.buckets) console.log(`    ${b.label}: ${b.state}`);
} else {
  check(
    "every bucket is BSC-only and mainnet-only",
    data.buckets.every((b) =>
      b.discovered.every((d) => d.agent.chainId === 56 && d.agent.isTestnet === false)
    )
  );
  check(
    "counts are auditable: matched ≤ retrieved ≤ hits",
    data.buckets.every((b) => b.matched <= b.retrieved && (b.hits == null || b.retrieved <= b.hits))
  );
  check(
    "bucket rows are real records (slug = registry agent_id)",
    data.buckets.every((b) =>
      b.discovered.every((d) => d.agent.slug.length > 0 && d.agent.source === "8004scan")
    )
  );
  for (const b of data.buckets) {
    check(
      `evidence is a real excerpt of the record's metadata (${b.key})`,
      b.discovered.every((d) => {
        const text = d.match.evidence === "description" ? d.agent.description : d.agent.name;
        if (text == null) return false;
        const core = d.match.evidenceText.replace(/^…/, "").replace(/…$/, "");
        return text.includes(core) && d.match.source === "8004scan metadata";
      })
    );
    check(
      `classification is deterministic — reclassifying reproduces the identical evidence (${b.key})`,
      b.discovered.every((d) => {
        const again = classifyAgent(d.agent);
        return again.categories.some(
          (m) => m.category === b.key && JSON.stringify(m) === JSON.stringify(d.match)
        );
      })
    );
  }
}

console.log("");
console.log("live discovery summary (real 8004scan records, chain 56, inferred categories):");
for (const b of data.buckets) {
  const hits = b.hits == null ? "—" : b.hits;
  console.log(
    `  ${b.label.padEnd(26)} hits=${String(hits).padEnd(4)} retrieved=${String(b.retrieved).padEnd(3)} matched=${b.matched}  state=${b.state}`
  );
  for (const d of b.discovered.slice(0, 3)) {
    console.log(`    · ${d.agent.slug}  ${d.agent.name}`);
    console.log(`        evidence[${d.match.evidence}] ${d.match.evidenceText}`);
  }
}
if (data.fetchedAt) console.log(`  fetched at ${data.fetchedAt}`);

console.log("");
console.log(`discovery live verify: ${passed} checks passed, ${failed} failed`);
if (failed > 0) process.exit(1);
